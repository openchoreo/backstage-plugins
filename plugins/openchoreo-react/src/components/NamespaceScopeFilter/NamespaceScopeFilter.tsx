import { useCallback, useMemo, useState } from 'react';
import Button from '@material-ui/core/Button';
import Popover from '@material-ui/core/Popover';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';
import Checkbox from '@material-ui/core/Checkbox';
import Divider from '@material-ui/core/Divider';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListSubheader from '@material-ui/core/ListSubheader';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import { CLUSTER_NAMESPACE } from '../../utils/platformOverviewConstants';
import { useNamespaceScopeFilterStyles } from './styles';

const CLUSTER_DISPLAY_LABEL = 'Cluster';

export interface NamespaceScopeFilterProps {
  /** Word used in the trigger button label, e.g. "Scope" or "Namespace". */
  label: string;
  /**
   * Raw namespace names available for selection. The special value
   * `openchoreo-cluster` (exported as `CLUSTER_NAMESPACE`) is auto-extracted
   * and rendered at the top as "Cluster"; the remaining names appear under
   * a "Namespaces" subheader.
   */
  availableNamespaces: string[];
  /** Currently selected namespace names (including `openchoreo-cluster` if selected). */
  selected: string[];
  onChange: (next: string[]) => void;
  /**
   * Minimum number of selections that must remain. When the current selection
   * is at the floor, the corresponding items are disabled to prevent
   * deselection. Defaults to 0.
   */
  minSelection?: number;
  /** Label shown in the trigger when no namespace is selected. Defaults to "None". */
  emptyLabel?: string;
  /**
   * Whether the Cluster row should be shown when present in
   * `availableNamespaces`. Defaults to true.
   */
  showCluster?: boolean;
  /**
   * Extra class merged onto the trigger button, so callers can override
   * height, background, etc. without forking the component.
   */
  triggerClassName?: string;
  /** Stretch the trigger button to fill its container. Defaults to false. */
  fullWidth?: boolean;
  /**
   * Hide the `label:` prefix inside the trigger button. Useful when the
   * caller already renders the label above the picker. Defaults to false.
   */
  hideLabelInTrigger?: boolean;
}

/**
 * Trigger-and-popover style multi-select for namespaces. The
 * `openchoreo-cluster` entry is relabeled "Cluster" and pinned to the top of
 * the popover; remaining namespaces are listed under a "Namespaces" subheader.
 *
 * Selection is represented as an array of raw namespace names so callers can
 * map to whatever value shape they need (entity refs, query params, etc.).
 */
export const NamespaceScopeFilter = ({
  label,
  availableNamespaces,
  selected,
  onChange,
  minSelection = 0,
  emptyLabel = 'None',
  showCluster = true,
  triggerClassName,
  fullWidth = false,
  hideLabelInTrigger = false,
}: NamespaceScopeFilterProps) => {
  const classes = useNamespaceScopeFilterStyles();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);

  const hasCluster =
    showCluster && availableNamespaces.includes(CLUSTER_NAMESPACE);
  const otherNamespaces = useMemo(
    () =>
      availableNamespaces
        .filter(ns => ns !== CLUSTER_NAMESPACE)
        .slice()
        .sort((a, b) => a.localeCompare(b)),
    [availableNamespaces],
  );

  const clusterSelected = selected.includes(CLUSTER_NAMESPACE);
  const selectedNamespaces = useMemo(
    () => selected.filter(s => s !== CLUSTER_NAMESPACE),
    [selected],
  );

  const buttonLabel = useMemo(() => {
    const parts: string[] = [];
    if (clusterSelected) parts.push(CLUSTER_DISPLAY_LABEL);
    if (selectedNamespaces.length === 1) {
      parts.push(selectedNamespaces[0]);
    } else if (selectedNamespaces.length > 1) {
      parts.push(`${selectedNamespaces.length} namespaces`);
    }
    const value = parts.length === 0 ? emptyLabel : parts.join(' + ');
    return hideLabelInTrigger ? value : `${label}: ${value}`;
  }, [clusterSelected, selectedNamespaces, label, emptyLabel, hideLabelInTrigger]);

  const toggle = useCallback(
    (item: string) => {
      const current = new Set(selected);
      if (current.has(item)) {
        if (current.size <= minSelection) return;
        current.delete(item);
      } else {
        current.add(item);
      }
      onChange([...current]);
    },
    [selected, minSelection, onChange],
  );

  const renderRow = (
    name: string,
    displayLabel: string,
    isSelected: boolean,
  ) => {
    const lockedLast = isSelected && selected.length <= minSelection;
    return (
      <MenuItem
        key={name}
        className={classes.menuItem}
        disabled={lockedLast}
        onClick={() => toggle(name)}
      >
        <ListItemIcon>
          <Checkbox
            className={classes.checkbox}
            checked={isSelected}
            disabled={lockedLast}
            color="primary"
            size="small"
            disableRipple
          />
        </ListItemIcon>
        <ListItemText primary={displayLabel} />
      </MenuItem>
    );
  };

  return (
    <>
      <Button
        className={[
          classes.triggerButton,
          fullWidth && classes.triggerButtonFullWidth,
          triggerClassName,
        ]
          .filter(Boolean)
          .join(' ')}
        endIcon={<ArrowDropDownIcon />}
        onClick={e => setAnchor(e.currentTarget)}
      >
        <span className={classes.triggerLabel}>{buttonLabel}</span>
      </Button>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          className: classes.popoverPaper,
          style: fullWidth && anchor ? { width: anchor.clientWidth } : undefined,
        }}
      >
        {hasCluster && (
          <>
            <MenuList dense>
              {renderRow(
                CLUSTER_NAMESPACE,
                CLUSTER_DISPLAY_LABEL,
                clusterSelected,
              )}
            </MenuList>
            <Divider />
          </>
        )}
        {otherNamespaces.length > 0 && (
          <>
            <ListSubheader className={classes.subheader} disableSticky>
              Namespaces
            </ListSubheader>
            <MenuList dense>
              {otherNamespaces.map(ns =>
                renderRow(ns, ns, selectedNamespaces.includes(ns)),
              )}
            </MenuList>
          </>
        )}
      </Popover>
    </>
  );
};
