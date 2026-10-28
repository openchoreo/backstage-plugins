import { useCallback, useState } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import Alert from '@material-ui/lab/Alert';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import type { ReleaseLineResource } from '@openchoreo/backstage-plugin-common';
import { YamlEditor, useYamlEditor } from '@openchoreo/backstage-plugin-react';
import { getErrorMessage, isForbiddenError } from '../../utils/errorUtils';
import { parseReleaseLineYaml } from './releaseLineUtils';
import { useReleaseLineDefinitionStyles } from './styles';

export interface ReleaseLineYamlPanelProps {
  /** The release line as fetched, to validate edits against. */
  releaseLine: ReleaseLineResource;
  /** The release line as shown in the editor (memoized by the caller). */
  content: Record<string, unknown>;
  readOnly: boolean;
  isSaving: boolean;
  onSave: (releaseLine: ReleaseLineResource) => Promise<unknown>;
}

/**
 * The release line's YAML, editable: its annotations (such as its
 * description) and labels, and the properties it overrides.
 */
export function ReleaseLineYamlPanel({
  releaseLine,
  content,
  readOnly,
  isSaving,
  onSave,
}: ReleaseLineYamlPanelProps) {
  const classes = useReleaseLineDefinitionStyles();
  const alertApi = useApi(alertApiRef);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(
    async (edited: Record<string, unknown>) => {
      setError(null);
      try {
        await onSave(parseReleaseLineYaml(edited, releaseLine));
        alertApi.post({
          message: 'Release line saved',
          severity: 'success',
          display: 'transient',
        });
      } catch (err) {
        setError(
          isForbiddenError(err)
            ? 'You do not have permission to change this release line.'
            : getErrorMessage(err),
        );
        throw err;
      }
    },
    [onSave, releaseLine, alertApi],
  );

  const yamlEditor = useYamlEditor({
    initialContent: content,
    onSave: handleSave,
  });

  return (
    <Box className={classes.panel}>
      <Box className={classes.panelHeader}>
        <Box>
          <Typography className={classes.panelTitle}>Release line</Typography>
          <Typography variant="caption" className={classes.panelCaption}>
            Edit its annotations (e.g. openchoreo.dev/description), labels and
            overrides: autoDeploy, parameters, traits and workflow parameters.
            Parameters are deep-merged onto the component's; traits are merged
            by kind, name and instance name.
          </Typography>
        </Box>
      </Box>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Box className={classes.editorContainer}>
        <YamlEditor
          content={yamlEditor.content}
          onChange={yamlEditor.setContent}
          onSave={yamlEditor.handleSave}
          onDiscard={yamlEditor.handleDiscard}
          errorText={yamlEditor.parseError}
          isDirty={yamlEditor.isDirty}
          isSaving={isSaving}
          readOnly={readOnly}
        />
      </Box>
    </Box>
  );
}
