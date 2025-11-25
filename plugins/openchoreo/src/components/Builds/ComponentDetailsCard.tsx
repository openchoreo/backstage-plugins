import type { FC } from 'react';
import { Typography, Button, Box, Link, IconButton } from '@material-ui/core';
import { Card } from '@openchoreo/backstage-design-system';
import GitHub from '@material-ui/icons/GitHub';
import CallSplit from '@material-ui/icons/CallSplit';
import FileCopy from '@material-ui/icons/FileCopy';
import type { ModelsCompleteComponent } from '@openchoreo/backstage-plugin-common';
import {
  getRepositoryUrl,
  getRepositoryInfo,
} from '@openchoreo/backstage-plugin-common';

interface ComponentDetailsCardProps {
  componentDetails: ModelsCompleteComponent;
  onTriggerBuild: () => void;
  triggeringBuild: boolean;
}

/**
 * Copy text to clipboard with fallback for older browsers.
 */
async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
}

/**
 * Displays component details with repository info and build trigger button.
 */
export const ComponentDetailsCard: FC<ComponentDetailsCardProps> = ({
  componentDetails,
  onTriggerBuild,
  triggeringBuild,
}) => {
  const repoUrl = getRepositoryUrl(componentDetails);
  const repoInfo = getRepositoryInfo(componentDetails);

  return (
    <Card padding={16} style={{ marginBottom: 16 }}>
      <Box>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {componentDetails.type}
        </Typography>
        <Typography variant="h6" style={{ marginBottom: '16px' }}>
          {componentDetails.displayName || componentDetails.name}
        </Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Source
        </Typography>
        <Box display="flex" alignItems="center" style={{ marginBottom: '8px' }}>
          <GitHub
            style={{ fontSize: '16px', marginRight: '6px', color: '#666' }}
          />
          <Link
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '13px' }}
          >
            {repoUrl}
          </Link>
          <IconButton
            size="small"
            onClick={() => copyToClipboard(repoUrl || '')}
            style={{ marginLeft: '8px', padding: '4px' }}
            title="Copy URL to clipboard"
          >
            <FileCopy style={{ fontSize: '14px', color: '#666' }} />
          </IconButton>
        </Box>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          style={{ marginBottom: '8px' }}
        >
          <Box display="flex" alignItems="center">
            <CallSplit
              style={{
                fontSize: '16px',
                marginRight: '6px',
                color: '#666',
              }}
            />
            <Typography variant="body2">{repoInfo.branch || 'N/A'}</Typography>
          </Box>
          <Box display="flex">
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={onTriggerBuild}
              disabled={triggeringBuild}
              style={{ marginRight: '12px' }}
            >
              {triggeringBuild ? 'Building...' : 'Build Latest'}
            </Button>
            <Button variant="outlined" size="small" onClick={() => {}}>
              Show Commits
            </Button>
          </Box>
        </Box>
      </Box>
    </Card>
  );
};
