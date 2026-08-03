import { ChangeEvent, FC } from 'react';
import { Skeleton } from '@openchoreo/backstage-design-system';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import Tooltip from '@material-ui/core/Tooltip';
import { Environment } from './types';

export interface EnvironmentFilterProps {
  environments: Environment[];
  value: Environment | null;
  onChange: (env: Environment | null) => void;
  loading?: boolean;
  label?: string;
  size?: 'small' | 'medium';
  disabled?: boolean;
  fullWidth?: boolean;
  isEnvDisabled?: (env: Environment) => boolean;
  disabledTooltip?: string | ((env: Environment) => string);
}

export const EnvironmentFilter: FC<EnvironmentFilterProps> = ({
  environments,
  value,
  onChange,
  loading = false,
  label = 'Environment',
  size = 'small',
  disabled = false,
  fullWidth = true,
  isEnvDisabled,
  disabledTooltip,
}) => {
  const handleChange = (event: ChangeEvent<{ value: unknown }>) => {
    const selectedName = event.target.value as string;
    const next = environments.find(e => e.name === selectedName) ?? null;
    onChange(next);
  };

  return (
    <FormControl
      fullWidth={fullWidth}
      disabled={disabled || loading}
      variant="outlined"
      size={size}
    >
      <InputLabel id="environment-filter-label">{label}</InputLabel>
      {loading ? (
        <Skeleton variant="rect" height={size === 'small' ? 40 : 56} />
      ) : (
        <Select
          labelId="environment-filter-label"
          label={label}
          value={value?.name ?? ''}
          onChange={handleChange}
        >
          {environments.length === 0 && (
            <MenuItem value="" disabled>
              No environments
            </MenuItem>
          )}
          {environments.map(env => {
            const itemDisabled = isEnvDisabled?.(env) ?? false;
            const item = (
              <MenuItem key={env.name} value={env.name} disabled={itemDisabled}>
                {env.displayName || env.name}
              </MenuItem>
            );
            if (!itemDisabled || !disabledTooltip) return item;
            const title =
              typeof disabledTooltip === 'function'
                ? disabledTooltip(env)
                : disabledTooltip;
            return (
              <Tooltip key={env.name} title={title} placement="right">
                <span>{item}</span>
              </Tooltip>
            );
          })}
        </Select>
      )}
    </FormControl>
  );
};
