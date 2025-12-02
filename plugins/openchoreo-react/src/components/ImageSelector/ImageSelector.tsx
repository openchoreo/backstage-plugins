import type { FC } from 'react';
import {
  TextField,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
} from '@material-ui/core';
import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';
import { formatRelativeTime } from '../../utils/timeUtils';

export interface ImageSelectorProps {
  /** Currently selected image URI */
  image: string | undefined;
  /** Available builds to select from */
  builds: ModelsBuild[];
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Callback when image selection changes */
  onChange: (value: string) => void;
  /** Label for the text field (default: "Image") */
  textFieldLabel?: string;
  /** Label for the select dropdown (default: "Select Image from Builds") */
  selectLabel?: string;
  /** Placeholder for the text field */
  placeholder?: string;
}

/**
 * Renders either a text field or dropdown for selecting container image.
 *
 * - Shows dropdown when builds are available (from-source component)
 * - Shows text field when no builds available (from-image component or no builds yet)
 *
 * @example
 * ```tsx
 * // With builds - shows dropdown
 * <ImageSelector
 *   image={container.image}
 *   builds={availableBuilds}
 *   onChange={(image) => handleImageChange(image)}
 * />
 *
 * // Without builds - shows text field
 * <ImageSelector
 *   image={container.image}
 *   builds={[]}
 *   onChange={(image) => handleImageChange(image)}
 * />
 * ```
 */
export const ImageSelector: FC<ImageSelectorProps> = ({
  image,
  builds,
  disabled = false,
  onChange,
  textFieldLabel = 'Image',
  selectLabel = 'Select Image from Builds',
  placeholder = 'Enter container image (e.g., nginx:latest)',
}) => {
  // Show text field if no builds available
  if (builds.length === 0) {
    return (
      <TextField
        label={textFieldLabel}
        value={image || ''}
        onChange={e => onChange(e.target.value)}
        fullWidth
        variant="outlined"
        disabled={disabled}
        placeholder={placeholder}
      />
    );
  }

  // Show dropdown to select from builds (from-source component with builds)
  return (
    <FormControl fullWidth variant="outlined">
      <InputLabel>{selectLabel}</InputLabel>
      <Select
        value={image || ''}
        onChange={e => onChange(e.target.value as string)}
        label={selectLabel}
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
