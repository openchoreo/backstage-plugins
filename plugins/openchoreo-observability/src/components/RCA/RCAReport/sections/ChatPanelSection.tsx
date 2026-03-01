import {
  Children,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import {
  Typography,
  Box,
  IconButton,
  TextField,
  InputAdornment,
} from '@material-ui/core';
import ChatOutlinedIcon from '@material-ui/icons/ChatOutlined';
import SendIcon from '@material-ui/icons/Send';
import StopIcon from '@material-ui/icons/Stop';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import { InfoCard } from '@backstage/core-components';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remend from 'remend';
import { useRCAReportStyles } from '../styles';
import { FormattedText } from '../FormattedText';
import { EntityLinkContext, useEntityLinkContext } from '../EntityLinkContext';
import {
  extractEntityUids,
  useEntitiesByUids,
} from '../../../../hooks/useEntitiesByUids';
import type {
  RCAAgentApi,
  ChatMessage,
  StreamEvent,
} from '../../../../api/RCAAgentApi';

// Process React children, replacing string nodes with FormattedText
// Use disableMarkdown since the parent ReactMarkdown already parsed the markdown
function processChildren(children: ReactNode): ReactNode {
  return Children.map(children, child => {
    if (typeof child === 'string') {
      return <FormattedText text={child} disableMarkdown />;
    }
    return child;
  });
}

// Custom ReactMarkdown components that process UUIDs and timestamps
const markdownComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <p>{processChildren(children)}</p>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li>{processChildren(children)}</li>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td>{processChildren(children)}</td>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th>{processChildren(children)}</th>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong>{processChildren(children)}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => (
    <em>{processChildren(children)}</em>
  ),
  h1: ({ children }: { children?: ReactNode }) => (
    <h1>{processChildren(children)}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2>{processChildren(children)}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3>{processChildren(children)}</h3>
  ),
  h4: ({ children }: { children?: ReactNode }) => (
    <h4>{processChildren(children)}</h4>
  ),
  h5: ({ children }: { children?: ReactNode }) => (
    <h5>{processChildren(children)}</h5>
  ),
  h6: ({ children }: { children?: ReactNode }) => (
    <h6>{processChildren(children)}</h6>
  ),
};

interface ChatContext {
  namespaceName: string;
  environmentName: string;
  projectName: string;
  rcaAgentApi: RCAAgentApi;
}

interface ChatPanelProps {
  reportId: string;
  chatContext: ChatContext;
}

export const ChatPanelSection = ({ reportId, chatContext }: ChatPanelProps) => {
  const classes = useRCAReportStyles();
  const [chatMessage, setChatMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // localStorage key for persisting chat messages
  const chatStorageKey = `rca-chat:${reportId}`;

  // Load messages from localStorage on mount
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem(chatStorageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist messages to localStorage when they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(chatStorageKey, JSON.stringify(messages));
    }
  }, [messages, chatStorageKey]);

  // Auto-scroll chat pane to bottom when messages change or streaming content updates
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Extract UUIDs from chat messages and streaming content for entity resolution
  const parentContext = useEntityLinkContext();
  const chatUids = useMemo(() => {
    const allContent = `${messages
      .map(m => m.content)
      .join(' ')} ${streamingContent}`;
    return extractEntityUids(allContent);
  }, [messages, streamingContent]);

  const { entityMap: chatEntityMap, loading: chatEntitiesLoading } =
    useEntitiesByUids(chatUids);

  // Merge parent context entities with chat-specific entities
  const mergedContext = useMemo(() => {
    const mergedMap = new Map(parentContext.entityMap);
    for (const [uid, info] of chatEntityMap) {
      if (!mergedMap.has(uid)) {
        mergedMap.set(uid, info);
      }
    }
    return {
      entityMap: mergedMap,
      loading: parentContext.loading || chatEntitiesLoading,
    };
  }, [parentContext, chatEntityMap, chatEntitiesLoading]);

  const handleSendMessage = useCallback(async () => {
    if (!chatMessage.trim() || isSending) return;

    const trimmedMessage = chatMessage.trim();
    const userMessage: ChatMessage = { role: 'user', content: trimmedMessage };
    const updatedMessages = [...messages, userMessage];
    const messagesToSend = [
      ...messages,
      {
        role: 'user' as const,
        content: `[${new Date().toISOString()}] \n${trimmedMessage}`,
      },
    ];

    setMessages(updatedMessages);
    setChatMessage('');
    setIsSending(true);
    setStreamingContent('');
    setToolStatus(null);
    setChatError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await chatContext.rcaAgentApi.streamRCAChat(
        {
          reportId: reportId || '',
          namespace: chatContext.namespaceName,
          project: chatContext.projectName,
          environment: chatContext.environmentName,
          messages: messagesToSend,
        },
        {
          namespaceName: chatContext.namespaceName,
          environmentName: chatContext.environmentName,
        },
        (event: StreamEvent) => {
          switch (event.type) {
            case 'message_chunk':
              setStreamingContent(prev => prev + event.content);
              setToolStatus(null);
              break;
            case 'tool_call':
              setToolStatus(event.activeForm || 'Digging deeper...');
              break;
            case 'done':
              // Finalize the assistant message
              setMessages(prev => [
                ...prev,
                { role: 'assistant', content: event.message },
              ]);
              setStreamingContent('');
              setToolStatus(null);
              break;
            case 'error':
              setChatError(event.message);
              setStreamingContent('');
              setToolStatus(null);
              break;
            case 'actions':
              // TODO: Handle actions
              break;
            default:
              // Unknown event type, ignore
              break;
          }
        },
        controller.signal,
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled - add partial content as message if any
        if (streamingContent) {
          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: `${streamingContent} (cancelled)` },
          ]);
        }
      } else {
        setChatError(
          err instanceof Error ? err.message : 'Failed to send message',
        );
      }
    } finally {
      setIsSending(false);
      setStreamingContent('');
      setToolStatus(null);
      abortControllerRef.current = null;
    }
  }, [
    chatMessage,
    isSending,
    messages,
    chatContext,
    reportId,
    streamingContent,
  ]);

  const handleCancelSend = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleClearChat = useCallback(() => {
    // Abort any ongoing stream first
    abortControllerRef.current?.abort();
    setChatMessage('');
    setMessages([]);
    setStreamingContent('');
    setToolStatus(null);
    setChatError(null);
    setIsSending(false);
    // Remove from localStorage
    localStorage.removeItem(chatStorageKey);
  }, [chatStorageKey]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  return (
    <EntityLinkContext.Provider value={mergedContext}>
      <Box className={classes.chatPanelWrapper}>
        <InfoCard
          title={
            <span className={classes.cardTitle}>
              <ChatOutlinedIcon className={classes.cardTitleIcon} />
              Chat with RCA Agent
            </span>
          }
          action={
            <Box display="flex" alignItems="center" height="100%">
              <IconButton
                size="small"
                onClick={handleClearChat}
                title="Clear chat"
                style={{ padding: 4 }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          }
          className={classes.chatPanel}
        >
          <Box className={classes.chatContent}>
            <div className={classes.chatMessages} ref={chatMessagesRef}>
              {/* To push messages to bottom */}
              <div style={{ marginTop: 'auto' }} />
              {messages.length === 0 && !streamingContent && !toolStatus ? (
                <Typography
                  variant="body2"
                  color="textSecondary"
                  align="center"
                >
                  Ask follow-up questions, search logs, or explore related
                  issues
                </Typography>
              ) : (
                <>
                  {messages.map((msg, index) => (
                    <Box
                      key={index}
                      className={
                        msg.role === 'user'
                          ? classes.chatMessageUser
                          : classes.chatMessageAssistant
                      }
                    >
                      <Box className={classes.markdownContent}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={markdownComponents}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </Box>
                    </Box>
                  ))}
                  {streamingContent && (
                    <Box className={classes.chatMessageAssistant}>
                      <Box className={classes.markdownContent}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={markdownComponents}
                        >
                          {remend(streamingContent)}
                        </ReactMarkdown>
                      </Box>
                    </Box>
                  )}
                </>
              )}
            </div>
            {chatError && (
              <Box className={classes.chatError}>
                <Typography variant="body2" color="error">
                  {chatError}
                </Typography>
              </Box>
            )}
            {isSending && !streamingContent && (
              <Box className={classes.statusStrip}>
                <Typography variant="caption" className={classes.statusText}>
                  {toolStatus || 'Thinking...'}
                </Typography>
              </Box>
            )}
            <Box className={classes.chatInputArea}>
              <TextField
                fullWidth
                variant="outlined"
                size="small"
                placeholder="Type your question..."
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isSending}
                className={
                  isSending && !streamingContent
                    ? classes.inputPulsing
                    : undefined
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      {isSending ? (
                        <IconButton
                          size="small"
                          onClick={handleCancelSend}
                          title="Cancel"
                          className={
                            isSending && !streamingContent
                              ? classes.buttonPulsing
                              : undefined
                          }
                        >
                          <StopIcon fontSize="small" />
                        </IconButton>
                      ) : (
                        <IconButton
                          size="small"
                          color="primary"
                          disabled={!chatMessage.trim()}
                          onClick={handleSendMessage}
                        >
                          <SendIcon />
                        </IconButton>
                      )}
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          </Box>
        </InfoCard>
      </Box>
    </EntityLinkContext.Provider>
  );
};
