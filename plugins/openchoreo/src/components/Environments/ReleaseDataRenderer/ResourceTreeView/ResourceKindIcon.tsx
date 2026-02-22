import type { FC } from 'react';
import clsx from 'clsx';
import { useTreeStyles } from './treeStyles';

interface ResourceKindIconProps {
  kind: string;
  isRoot?: boolean;
}

export const ResourceKindIcon: FC<ResourceKindIconProps> = ({
  kind,
  isRoot,
}) => {
  const classes = useTreeStyles();

  // Extract uppercase initials (e.g., "Deployment" -> "D", "CronJob" -> "CJ")
  const initials = kind.replace(/[a-z]/g, '');
  const displayInitials = initials.length > 2 ? initials.slice(0, 2) : initials;
  return (
    <div className={classes.kindIconContainer}>
      <div
        className={clsx(
          classes.kindIcon,
          isRoot && classes.kindIconRoot,
          initials.length > 2 && classes.kindIconSmallText,
        )}
      >
        {displayInitials}
      </div>
    </div>
  );
};
