import { ChangeEvent, useState, useEffect, useMemo, ReactNode } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  CircularProgress,
  Box,
  Card,
  CardContent,
  Typography,
  Radio,
  Link,
  Collapse,
  makeStyles,
  alpha,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import NodejsOriginal from 'devicons-react/lib/icons/NodejsOriginal';
import JavaOriginal from 'devicons-react/lib/icons/JavaOriginal';
import GoOriginal from 'devicons-react/lib/icons/GoOriginal';
import PythonOriginal from 'devicons-react/lib/icons/PythonOriginal';
import RubyOriginal from 'devicons-react/lib/icons/RubyOriginal';
import PhpOriginal from 'devicons-react/lib/icons/PhpOriginal';
import DotNetOriginal from 'devicons-react/lib/icons/DotNetOriginal';
import BallerinaOriginal from 'devicons-react/lib/icons/BallerinaOriginal';
import DockerOriginal from 'devicons-react/lib/icons/DockerOriginal';

/*
 Schema for the Build Workflow Picker field
*/
export const BuildWorkflowPickerSchema = {
  returnValue: { type: 'string' as const },
};

/**
 * Special treatment: hardcoded buildpack workflow → language options mapping.
 * TODO: Replace with metadata from ComponentWorkflow definition once supported.
 *
 * When allowedWorkflows contains any of these buildpack workflow names, the picker
 * renders a language card selector instead of a raw workflow dropdown.
 * Google Cloud Buildpacks auto-detects language from source code, so multiple
 * language options map to the same workflow. Ballerina uses a dedicated workflow.
 */
const BUILDPACK_WORKFLOW_NAMES = new Set([
  'google-cloud-buildpacks',
  'ballerina-buildpack',
]);

const ICON_SIZE = 24;

interface LanguageOption {
  /** Unique key for this option (used for UI state tracking) */
  key: string;
  /** The workflow name this option maps to */
  workflow: string;
  /** Display label */
  label: string;
  /** Short description */
  description: string;
  /** Icon element */
  icon: ReactNode;
}

/**
 * All known language options mapped to their buildpack workflows.
 * Only options whose workflow is present in allowedWorkflows will be shown.
 *
 * Google Cloud Buildpacks supported languages:
 * https://cloud.google.com/docs/buildpacks/builders
 */
const ALL_LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    key: 'nodejs',
    workflow: 'google-cloud-buildpacks',
    label: 'Node.js',
    description: 'Auto-detected via Google Cloud Buildpacks',
    icon: <NodejsOriginal size={ICON_SIZE} />,
  },
  {
    key: 'java',
    workflow: 'google-cloud-buildpacks',
    label: 'Java',
    description: 'Auto-detected via Google Cloud Buildpacks',
    icon: <JavaOriginal size={ICON_SIZE} />,
  },
  {
    key: 'go',
    workflow: 'google-cloud-buildpacks',
    label: 'Go',
    description: 'Auto-detected via Google Cloud Buildpacks',
    icon: <GoOriginal size={ICON_SIZE} />,
  },
  {
    key: 'python',
    workflow: 'google-cloud-buildpacks',
    label: 'Python',
    description: 'Auto-detected via Google Cloud Buildpacks',
    icon: <PythonOriginal size={ICON_SIZE} />,
  },
  {
    key: 'ruby',
    workflow: 'google-cloud-buildpacks',
    label: 'Ruby',
    description: 'Auto-detected via Google Cloud Buildpacks',
    icon: <RubyOriginal size={ICON_SIZE} />,
  },
  {
    key: 'php',
    workflow: 'google-cloud-buildpacks',
    label: 'PHP',
    description: 'Auto-detected via Google Cloud Buildpacks',
    icon: <PhpOriginal size={ICON_SIZE} />,
  },
  {
    key: 'dotnet',
    workflow: 'google-cloud-buildpacks',
    label: '.NET',
    description: 'Auto-detected via Google Cloud Buildpacks',
    icon: <DotNetOriginal size={ICON_SIZE} />,
  },
  {
    key: 'ballerina',
    workflow: 'ballerina-buildpack',
    label: 'Ballerina',
    description: 'Built with Ballerina Buildpack',
    icon: <BallerinaOriginal size={ICON_SIZE} />,
  },
  {
    key: 'docker',
    workflow: 'docker',
    label: 'Docker',
    description: 'Build with a Dockerfile',
    icon: <DockerOriginal size={ICON_SIZE} />,
  },
];

const useLanguageSelectorStyles = makeStyles(theme => ({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(1),
  },
  card: {
    cursor: 'pointer',
    transition: 'border-color 0.2s ease, background-color 0.2s ease',
    '&:hover': {
      borderColor: theme.palette.primary.light,
    },
  },
  cardSelected: {
    borderColor: theme.palette.primary.main,
    borderWidth: 2,
    backgroundColor: alpha(theme.palette.primary.main, 0.04),
  },
  cardContent: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(1.5),
    '&:last-child': {
      paddingBottom: theme.spacing(1.5),
    },
  },
  iconWrapper: {
    flexShrink: 0,
    marginRight: theme.spacing(1.5),
    display: 'flex',
    alignItems: 'center',
  },
  labelSection: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontWeight: 500,
    lineHeight: 1.2,
  },
  description: {
    color: theme.palette.text.secondary,
    lineHeight: 1.3,
    fontSize: '0.75rem',
  },
  radio: {
    padding: 0,
    marginLeft: theme.spacing(1),
  },
  advancedToggle: {
    display: 'flex',
    alignItems: 'center',
    marginTop: theme.spacing(1.5),
    cursor: 'pointer',
    color: theme.palette.text.secondary,
    '&:hover': {
      color: theme.palette.primary.main,
    },
  },
  advancedIcon: {
    fontSize: 18,
    marginLeft: theme.spacing(0.5),
  },
}));

/**
 * Check if any of the provided workflows are known buildpack workflows.
 */
function hasBuildpackWorkflows(workflows: string[]): boolean {
  return workflows.some(w => BUILDPACK_WORKFLOW_NAMES.has(w));
}

/**
 * Get the available language options filtered by allowed workflows.
 */
function getAvailableLanguageOptions(
  allowedWorkflows: string[],
): LanguageOption[] {
  const workflowSet = new Set(allowedWorkflows);
  return ALL_LANGUAGE_OPTIONS.filter(opt => workflowSet.has(opt.workflow));
}

/**
 * Find the language option key that matches a workflow name.
 * Returns the first matching key (for workflows with multiple languages like GCB).
 */
function languageKeyForWorkflow(
  workflow: string,
  options: LanguageOption[],
): string | undefined {
  return options.find(opt => opt.workflow === workflow)?.key;
}

/*
 This is the actual component that will get rendered in the form

 Note: The workflows can be defined via enum in the schema (from allowedWorkflows in CTD).
 If enum is not provided, this component fetches all workflows from the API.
 The BuildWorkflowParameters component (which is a sibling field) reads the selected
 workflow from formData to fetch its schema.
*/
export const BuildWorkflowPicker = ({
  onChange,
  rawErrors,
  required,
  formData,
  idSchema,
  uiSchema,
  schema,
}: FieldExtensionComponentProps<string>) => {
  const [workflowOptions, setWorkflowOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguageKey, setSelectedLanguageKey] = useState<
    string | undefined
  >(undefined);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const classes = useLanguageSelectorStyles();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  // Get workflows from enum (if provided) or namespaceName from ui:options
  const enumWorkflows = (schema.enum as string[]) || null;
  const namespaceName =
    typeof uiSchema?.['ui:options']?.namespaceName === 'string'
      ? uiSchema['ui:options'].namespaceName
      : '';

  const showLanguageSelector =
    enumWorkflows &&
    enumWorkflows.length > 0 &&
    hasBuildpackWorkflows(enumWorkflows);
  const languageOptions = useMemo(
    () =>
      showLanguageSelector ? getAvailableLanguageOptions(enumWorkflows) : [],
    [showLanguageSelector, enumWorkflows],
  );

  // Initialize selected language key from existing formData
  useEffect(() => {
    if (showLanguageSelector && formData && !selectedLanguageKey) {
      const key = languageKeyForWorkflow(formData, languageOptions);
      if (key) {
        setSelectedLanguageKey(key);
      }
    }
  }, [showLanguageSelector, formData, selectedLanguageKey, languageOptions]);

  // Fetch workflows from API if enum is not provided
  useEffect(() => {
    let ignore = false;

    const fetchWorkflows = async () => {
      // If enum is provided, use it directly
      if (enumWorkflows && enumWorkflows.length > 0) {
        setWorkflowOptions(enumWorkflows);
        return;
      }

      // Otherwise, fetch from API
      if (!namespaceName) {
        setError('Namespace name is required to fetch workflows');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const baseUrl = await discoveryApi.getBaseUrl('openchoreo-ci-backend');

        // Extract namespace name if it's in entity reference format
        const extractNsName = (fullNsName: string): string => {
          const parts = fullNsName.split('/');
          return parts[parts.length - 1];
        };

        const nsName = extractNsName(namespaceName);

        // Use fetchApi which automatically injects Backstage + IDP tokens
        const response = await fetchApi.fetch(
          `${baseUrl}/workflows?namespaceName=${encodeURIComponent(nsName)}`,
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (!ignore && result.success) {
          const workflows = result.data.items.map((item: any) => item.name);
          setWorkflowOptions(workflows);
        }
      } catch (err) {
        if (!ignore) {
          setError(`Failed to fetch workflows: ${err}`);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchWorkflows();

    return () => {
      ignore = true;
    };
  }, [namespaceName, enumWorkflows, discoveryApi, fetchApi]);

  const handleDropdownChange = (event: ChangeEvent<{ value: unknown }>) => {
    const selectedWorkflow = event.target.value as string;
    onChange(selectedWorkflow);
    // Sync language key if switching via advanced dropdown
    if (showLanguageSelector) {
      const key = languageKeyForWorkflow(selectedWorkflow, languageOptions);
      setSelectedLanguageKey(key);
    }
  };

  const handleLanguageSelect = (option: LanguageOption) => {
    setSelectedLanguageKey(option.key);
    onChange(option.workflow);
    // Collapse advanced when selecting via language cards
    setShowAdvanced(false);
  };

  const label = uiSchema?.['ui:title'] || schema.title || 'Build Workflow';

  // Render language card selector for buildpack workflows
  if (showLanguageSelector) {
    return (
      <Box>
        <Typography variant="body1" gutterBottom>
          {label}
        </Typography>
        {schema.description && (
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Choose the language or build method for your component
          </Typography>
        )}
        <Box className={classes.grid}>
          {languageOptions.map(option => {
            const isSelected = selectedLanguageKey === option.key;
            return (
              <Card
                key={option.key}
                variant="outlined"
                className={`${classes.card} ${
                  isSelected ? classes.cardSelected : ''
                }`}
                onClick={() => handleLanguageSelect(option)}
              >
                <CardContent className={classes.cardContent}>
                  <Box className={classes.iconWrapper}>
                    {option.icon}
                  </Box>
                  <Box className={classes.labelSection}>
                    <Typography variant="subtitle2" className={classes.label}>
                      {option.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      className={classes.description}
                    >
                      {option.description}
                    </Typography>
                  </Box>
                  <Radio
                    checked={isSelected}
                    className={classes.radio}
                    color="primary"
                    size="small"
                  />
                </CardContent>
              </Card>
            );
          })}
        </Box>

        {/* Advanced: raw workflow dropdown */}
        <Link
          component="button"
          variant="body2"
          className={classes.advancedToggle}
          onClick={() => setShowAdvanced(prev => !prev)}
          underline="none"
        >
          Advanced: Select workflow directly
          {showAdvanced ? (
            <ExpandLessIcon className={classes.advancedIcon} />
          ) : (
            <ExpandMoreIcon className={classes.advancedIcon} />
          )}
        </Link>
        <Collapse in={showAdvanced}>
          <FormControl
            fullWidth
            margin="dense"
            variant="outlined"
            error={!!rawErrors?.length || !!error}
          >
            <InputLabel id={`${idSchema?.$id}-label`}>Workflow</InputLabel>
            <Select
              labelId={`${idSchema?.$id}-label`}
              label="Workflow"
              value={formData || ''}
              onChange={handleDropdownChange}
              disabled={loading || workflowOptions.length === 0}
            >
              {workflowOptions.map(workflow => (
                <MenuItem key={workflow} value={workflow}>
                  {workflow}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Collapse>

        {error && <FormHelperText error>{error}</FormHelperText>}
        {rawErrors?.length ? (
          <FormHelperText error>{rawErrors.join(', ')}</FormHelperText>
        ) : null}
      </Box>
    );
  }

  // Standard dropdown for non-buildpack workflows
  return (
    <FormControl
      fullWidth
      margin="normal"
      variant="outlined"
      error={!!rawErrors?.length || !!error}
      required={required}
    >
      <InputLabel id={`${idSchema?.$id}-label`}>{label}</InputLabel>
      <Select
        labelId={`${idSchema?.$id}-label`}
        label={label}
        value={formData || ''}
        onChange={handleDropdownChange}
        disabled={loading || workflowOptions.length === 0}
      >
        {loading && (
          <MenuItem disabled>
            <CircularProgress size={20} style={{ marginRight: 8 }} />
            Loading workflows...
          </MenuItem>
        )}
        {!loading && workflowOptions.length === 0 && (
          <MenuItem disabled>No workflows available</MenuItem>
        )}
        {!loading &&
          workflowOptions.map(workflow => (
            <MenuItem key={workflow} value={workflow}>
              {workflow}
            </MenuItem>
          ))}
      </Select>
      {error && <FormHelperText error>{error}</FormHelperText>}
      {rawErrors?.length ? (
        <FormHelperText error>{rawErrors.join(', ')}</FormHelperText>
      ) : null}
      {schema.description && !rawErrors?.length && !error && (
        <FormHelperText>{schema.description}</FormHelperText>
      )}
    </FormControl>
  );
};

/*
 This is a validation function that will run when the form is submitted.
*/
export const buildWorkflowPickerValidation = (
  value: string,
  validation: FieldValidation,
) => {
  if (!value || value.trim() === '') {
    validation.addError('Build workflow is required when using built-in CI');
  }
};
