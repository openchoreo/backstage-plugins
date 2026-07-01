import {
  Children,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import {
  Typography,
  Box,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Drawer,
  Fab,
  Tooltip,
  makeStyles,
} from '@material-ui/core';
import ChatOutlinedIcon from '@material-ui/icons/ChatOutlined';
import SendIcon from '@material-ui/icons/Send';
import StopIcon from '@material-ui/icons/Stop';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import CloseIcon from '@material-ui/icons/Close';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remend from 'remend';
import { useRCAReportStyles } from '../styles';
import { FormattedText } from '../FormattedText';
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
      return <FormattedText text={child} disableMarkdown disableLinks />;
    }
    return child;
  });
}

// Convert <tag:name> to {{tag:name}} so ReactMarkdown doesn't strip them as HTML
function escapeEntityTags(text: string): string {
  return text.replace(/<((?:comp|proj|env|ns):[^>]+)>/g, '{{$1}}');
}

// Custom ReactMarkdown components that process entity tags and timestamps
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
  code: ({ children }: { children?: ReactNode }) => (
    <code>{processChildren(children)}</code>
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

const DRAWER_WIDTH = 440;

// Starter prompts shown on the empty chat — mirrors the Portal Assistant
// drawer's suggestion chips, scoped to follow-ups on an RCA report so the
// two chats read as the same assistant.
const CHAT_SUGGESTIONS = [
  'Explain the root cause',
  'What are the recommended fixes?',
  'Any related incidents?',
];

const useStyles = makeStyles(theme => ({
  fabRoot: {
    position: 'fixed',
    right: theme.spacing(3),
    bottom: theme.spacing(3),
    // One step below ``theme.zIndex.snackbar`` so real snackbars always
    // render above this launcher, matching the portal assistant FAB.
    zIndex: theme.zIndex.snackbar - 1,
  },
  fab: {
    boxShadow: theme.shadows[6],
  },
  drawerPaper: {
    width: DRAWER_WIDTH,
    maxWidth: '90vw',
    display: 'flex',
    flexDirection: 'column',
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  drawerHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  headerTitle: {
    fontWeight: 600,
  },
  composer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  // Tool-call / "Thinking..." status. Right-aligned (under the user's
  // latest turn) rather than centered, so the agent's progress reads as
  // a continuation of the conversation flow on the user side.
  statusStrip: {
    padding: theme.spacing(0.25, 2, 0, 2),
    textAlign: 'left',
  },
  emptyState: {
    padding: theme.spacing(2, 2, 1),
  },
  // Pill-strip of suggestion chips shown only on the empty timeline —
  // matches the Portal Assistant drawer's ``suggestionStrip``.
  suggestionStrip: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(2),
  },
  suggestionChip: {
    height: 'auto',
    cursor: 'pointer',
    '& .MuiChip-label': {
      whiteSpace: 'normal',
      paddingTop: theme.spacing(0.25),
      paddingBottom: theme.spacing(0.25),
    },
  },
}));

interface ChatContext {
  namespaceName: string;
  environmentName: string;
  projectName: string;
  rcaAgentApi: RCAAgentApi;
}

interface RCAChatDrawerProps {
  reportId: string;
  chatContext: ChatContext;
}

/**
 * Floating chat-icon launcher (bottom-right) that opens a right-anchored
 * drawer holding the RCA agent chat — mirroring the portal assistant's
 * FAB → drawer experience, but wired to {@link RCAAgentApi} and scoped to
 * a single RCA report. The conversation persists to localStorage per
 * report so closing/reopening the drawer keeps the timeline.
 */
export const RCAChatDrawer = ({
  reportId,
  chatContext,
}: RCAChatDrawerProps) => {
  const classes = useRCAReportStyles();
  const drawerClasses = useStyles();
  const [open, setOpen] = useState(false);
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

  // Auto-scroll chat pane to bottom when messages change or streaming content
  // updates — only meaningful while the drawer is open and the ref is mounted.
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages, streamingContent, open]);

  const sendText = useCallback(
    async (rawText: string) => {
      if (!rawText.trim() || isSending) return;

      const trimmedMessage = rawText.trim();
      const userMessage: ChatMessage = {
        role: 'user',
        content: trimmedMessage,
      };
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

      // Local mirror of the streamed text. The streamingContent STATE can't
      // be read back inside this same invocation (the closure captured its
      // value — '' — at send time), so accumulate here to preserve partial
      // output if the user cancels mid-stream.
      let assembled = '';

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
                assembled += event.content;
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
          if (assembled) {
            setMessages(prev => [
              ...prev,
              { role: 'assistant', content: `${assembled} (cancelled)` },
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
    },
    [isSending, messages, chatContext, reportId],
  );

  const handleSendMessage = useCallback(() => {
    void sendText(chatMessage);
  }, [chatMessage, sendText]);

  // Empty-state suggestion chips fire a turn immediately with pre-vetted
  // wording — mirrors the Portal Assistant drawer's starter prompts.
  const handleSuggestion = useCallback(
    (text: string) => {
      void sendText(text);
    },
    [sendText],
  );

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  return (
    <>
      {/* Only mount the launcher while the drawer is closed. Its z-index
          (snackbar - 1) sits above the temporary drawer's modal layer, so
          leaving it mounted would overlap the composer and intercept
          clicks at the bottom-right. The header close button handles
          dismissal. */}
      {!open && (
        <Tooltip title="Ask Portal Assistant" placement="left">
          <Fab
            color="primary"
            size="medium"
            className={drawerClasses.fab}
            classes={{ root: drawerClasses.fabRoot }}
            onClick={() => setOpen(true)}
            aria-label="Ask Portal Assistant"
          >
            <ChatOutlinedIcon />
          </Fab>
        </Tooltip>
      )}
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        classes={{ paper: drawerClasses.drawerPaper }}
      >
        <Box className={drawerClasses.drawerHeader}>
          <Typography variant="subtitle1" className={drawerClasses.headerTitle}>
            Portal Assistant
          </Typography>
          <Box className={drawerClasses.drawerHeaderActions}>
            <Tooltip title="Clear conversation">
              <span>
                <IconButton
                  size="small"
                  onClick={handleClearChat}
                  aria-label="Clear conversation"
                  disabled={isSending || messages.length === 0}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton
              size="small"
              onClick={() => setOpen(false)}
              aria-label="Close Portal Assistant chat"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        <Box className={classes.chatContent}>
          <div className={classes.chatMessages} ref={chatMessagesRef}>
            {/* To push messages to bottom */}
            <div style={{ marginTop: 'auto' }} />
            {messages.length === 0 && !streamingContent && !toolStatus ? (
              <Box className={drawerClasses.emptyState}>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  align="center"
                >
                  Ask follow-up questions, search logs, or explore related
                  issues
                </Typography>
                <Box className={drawerClasses.suggestionStrip}>
                  {CHAT_SUGGESTIONS.map(suggestion => (
                    <Chip
                      key={suggestion}
                      label={suggestion}
                      variant="outlined"
                      size="small"
                      clickable
                      className={drawerClasses.suggestionChip}
                      onClick={() => handleSuggestion(suggestion)}
                    />
                  ))}
                </Box>
              </Box>
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
                        {escapeEntityTags(msg.content)}
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
                        {escapeEntityTags(remend(streamingContent))}
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
            <Box className={drawerClasses.statusStrip}>
              <Typography variant="caption" className={classes.statusText}>
                {toolStatus || 'Thinking...'}
              </Typography>
            </Box>
          )}
          <Box className={drawerClasses.composer}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              variant="outlined"
              size="small"
              placeholder="Message Portal Assistant"
              value={chatMessage}
              onChange={e => setChatMessage(e.target.value)}
              onKeyDown={handleKeyDown}
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
                      <Tooltip title="Stop">
                        <IconButton
                          size="small"
                          onClick={handleCancelSend}
                          aria-label="Stop"
                          className={
                            isSending && !streamingContent
                              ? classes.buttonPulsing
                              : undefined
                          }
                        >
                          <StopIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Send (Enter)">
                        <span>
                          <IconButton
                            size="small"
                            color="primary"
                            disabled={!chatMessage.trim()}
                            onClick={handleSendMessage}
                            aria-label="Send message"
                          >
                            <SendIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Box>
      </Drawer>
    </>
  );
};
