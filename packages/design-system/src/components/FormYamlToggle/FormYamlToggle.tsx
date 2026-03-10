import { makeStyles } from '@material-ui/core/styles';
import { ToggleButton, ToggleButtonGroup } from '@material-ui/lab';

const useStyles = makeStyles(theme => ({
  root: {
    height: 28,
    '& .MuiToggleButtonGroup-grouped': {
      border: `1px solid ${theme.palette.divider}`,
      '&:not(:first-child)': {
        marginLeft: -1,
        borderLeft: `1px solid ${theme.palette.divider}`,
      },
    },
    '& .MuiToggleButton-root': {
      textTransform: 'none',
      padding: '2px 10px',
      fontSize: 12,
      fontWeight: 500,
      color: theme.palette.text.disabled,
      lineHeight: 1.5,
      borderRadius: 4,
      minWidth: 0,
    },
    '& .MuiToggleButton-root.Mui-selected': {
      backgroundColor: 'transparent',
      color: theme.palette.primary.main,
      borderColor: theme.palette.primary.main,
      fontWeight: 600,
      '&:hover': {
        backgroundColor:
          theme.palette.type === 'dark'
            ? 'rgba(108, 127, 216, 0.08)'
            : 'rgba(63, 81, 181, 0.04)',
      },
    },
  },
}));

export type FormYamlMode = 'form' | 'yaml';

export interface FormYamlToggleProps {
  /** Current mode */
  value: FormYamlMode;
  /** Called when the user clicks a different mode */
  onChange: (mode: FormYamlMode) => void;
  /** Disable both buttons */
  disabled?: boolean;
  /** Optional className on the outer group */
  className?: string;
}

export const FormYamlToggle = ({
  value,
  onChange,
  disabled,
  className,
}: FormYamlToggleProps) => {
  const classes = useStyles();

  const handleChange = (
    _: unknown,
    newMode: FormYamlMode | null,
  ) => {
    if (newMode) {
      onChange(newMode);
    }
  };

  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={handleChange}
      size="small"
      className={`${classes.root}${className ? ` ${className}` : ''}`}
    >
      <ToggleButton value="form" disabled={disabled}>
        Form
      </ToggleButton>
      <ToggleButton value="yaml" disabled={disabled}>
        YAML
      </ToggleButton>
    </ToggleButtonGroup>
  );
};
