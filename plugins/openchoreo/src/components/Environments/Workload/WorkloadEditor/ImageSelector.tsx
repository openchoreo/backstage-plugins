import type { FC } from 'react';
import {
  TextField,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
} from '@material-ui/core';
import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';
import { formatRelativeTime } from '@openchoreo/backstage-plugin-react';

interface ImageSelectorProps {
  image: string | undefined;
  builds: ModelsBuild[];
  disabled: boolean;
  onChange: (value: string) => void;
}

/**
 * Renders either a text field or dropdown for selecting container image.
 * Shows dropdown when builds are available (from-source component).
 * Shows text field when no builds available (from-image component or no builds yet).
 */
export const ImageSelector: FC<ImageSelectorProps> = ({
  image,
  builds,
  disabled,
  onChange,
}) => {
  // Show text field if no builds available
  if (builds.length === 0) {
    return (
      <TextField
        label="Image"
        value={image || ''}
        onChange={e => onChange(e.target.value)}
        fullWidth
        variant="outlined"
        disabled={disabled}
        placeholder="Enter container image (e.g., nginx:latest)"
      />
    );
  }

  // Show dropdown to select from builds (from-source component with builds)
  return (
    <FormControl fullWidth variant="outlined">
      <InputLabel>Select Image from Builds</InputLabel>
      <Select
        value={image || ''}
        onChange={e => onChange(e.target.value as string)}
        label="Select Image from Builds"
        variant="outlined"
        fullWidth
        disabled={disabled}
      >
        <MenuItem value="">
          <em>None</em>
        </MenuItem>
        {builds
          .filter(build => build.image)
          .map(
            build =>
              build.image && (
                <MenuItem key={build.image} value={build.image}>
                  {build.name} ({formatRelativeTime(build.createdAt || '')})
                </MenuItem>
              ),
          )}
      </Select>
    </FormControl>
  );
};
