import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Box, Button, ButtonBase, Chip, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import LanguageIcon from '@material-ui/icons/Language';
import SwapHorizIcon from '@material-ui/icons/SwapHoriz';
import SettingsEthernetIcon from '@material-ui/icons/SettingsEthernet';
import LockOutlinedIcon from '@material-ui/icons/LockOutlined';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  NO_ENDPOINT,
  endpointTypeOptions,
  parseEndpointTypeKey,
  type AllowedEndpointTypeEntry,
  type EndpointTypeOption,
} from '@openchoreo/backstage-plugin-common';

const useStyles = makeStyles(theme => ({
  panel: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.primary.main}`,
    borderRadius: 6,
    backgroundColor: theme.palette.background.default,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  heading: {
    fontWeight: 600,
    fontSize: '0.95rem',
  },
  intro: {
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: theme.spacing(2),
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    textAlign: 'left',
    height: '100%',
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    backgroundColor: theme.palette.background.paper,
    transition: 'border-color 0.15s, box-shadow 0.15s',
    '&:hover, &.Mui-focusVisible': {
      borderColor: theme.palette.primary.main,
      boxShadow: `0 0 0 1px ${theme.palette.primary.main}`,
    },
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
  },
  icon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 10,
    color: theme.palette.primary.main,
    backgroundColor: `${theme.palette.primary.main}14`,
  },
  iconMuted: {
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.action.hover,
  },
  name: {
    fontWeight: 600,
    fontSize: '0.95rem',
    lineHeight: 1.3,
  },
  ref: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    fontFamily: 'monospace',
  },
  description: {
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
    flex: 1,
    marginBottom: theme.spacing(1.5),
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
  },
}));

/** The title and description the catalog has for an Endpoint type. */
interface TypeDetails {
  title?: string;
  description?: string;
}

function entityRef(typeKey: string, namespace: string): string {
  const { kind, name } = parseEndpointTypeKey(typeKey);
  return kind === 'ClusterEndpointType'
    ? `clusterendpointtype:openchoreo-cluster/${name}`
    : `endpointtype:${namespace}/${name}`;
}

/**
 * Reads the title and description of each Endpoint type from the catalog,
 * keyed by EndpointType key. Types the catalog doesn't have, or a catalog
 * that can't be read, leave the picker with the type's name only.
 */
function useEndpointTypeDetails(
  keys: string[],
  namespace: string,
  enabled: boolean,
): Record<string, TypeDetails> {
  const catalogApi = useApi(catalogApiRef);
  const [details, setDetails] = useState<Record<string, TypeDetails>>({});
  const joined = keys.join(',');

  useEffect(() => {
    if (!enabled || !joined) return undefined;
    let cancelled = false;
    const typeKeys = joined.split(',');
    catalogApi
      .getEntitiesByRefs({
        entityRefs: typeKeys.map(key => entityRef(key, namespace)),
        fields: ['metadata.title', 'metadata.description'],
      })
      .then(({ items }) => {
        if (cancelled) return;
        const next: Record<string, TypeDetails> = {};
        items.forEach((entity, i) => {
          if (entity) {
            next[typeKeys[i]] = {
              title: entity.metadata.title,
              description: entity.metadata.description,
            };
          }
        });
        setDetails(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [catalogApi, joined, namespace, enabled]);

  return details;
}

/** An icon for the kind of traffic a type carries. */
function protocolIcon(protocols: string[]): ReactNode {
  if (protocols.some(p => ['HTTP', 'GraphQL', 'Websocket'].includes(p))) {
    return <LanguageIcon />;
  }
  if (protocols.includes('gRPC')) return <SwapHorizIcon />;
  return <SettingsEthernetIcon />;
}

interface TypeCardProps {
  icon: ReactNode;
  muted?: boolean;
  name: string;
  subtitle?: string;
  description: string;
  chips: ReactNode;
  onClick: () => void;
}

const TypeCard = ({
  icon,
  muted,
  name,
  subtitle,
  description,
  chips,
  onClick,
}: TypeCardProps) => {
  const classes = useStyles();
  return (
    <ButtonBase className={classes.card} onClick={onClick} focusRipple>
      <Box className={classes.cardTop}>
        <Box
          className={`${classes.icon} ${muted ? classes.iconMuted : ''}`}
          aria-hidden
        >
          {icon}
        </Box>
        <Box>
          <Typography className={classes.name}>{name}</Typography>
          {subtitle && (
            <Typography className={classes.ref}>{subtitle}</Typography>
          )}
        </Box>
      </Box>
      <Typography className={classes.description}>{description}</Typography>
      <Box className={classes.chips}>{chips}</Box>
    </ButtonBase>
  );
};

export interface EndpointTypePickerProps {
  open: boolean;
  allowedEndpoints: AllowedEndpointTypeEntry[];
  /** The OpenChoreo namespace, for reading namespaced EndpointTypes. */
  namespace: string;
  /** Called with the picked EndpointType key, or NO_ENDPOINT for project only. */
  onSelect: (typeKey: string) => void;
  onClose: () => void;
}

/**
 * The first step of adding an endpoint: one card per Endpoint type the
 * ComponentType allows, with its title, description and protocols, and a
 * card for an endpoint kept within the project. Shown in the Endpoints tab,
 * below its cards, in place of the Add button. Picking one opens the
 * endpoint's form with that type.
 */
export const EndpointTypePicker = ({
  open,
  allowedEndpoints,
  namespace,
  onSelect,
  onClose,
}: EndpointTypePickerProps) => {
  const classes = useStyles();
  const options = useMemo(
    () => endpointTypeOptions(allowedEndpoints),
    [allowedEndpoints],
  );
  const details = useEndpointTypeDetails(
    options.map(o => o.key),
    namespace,
    open,
  );

  const typeCard = (option: EndpointTypeOption) => {
    const { name } = parseEndpointTypeKey(option.key);
    const info = details[option.key];
    const title = info?.title || name;
    return (
      <TypeCard
        key={option.key}
        icon={protocolIcon(option.protocols)}
        name={title}
        subtitle={title === name ? undefined : name}
        description={
          info?.description || `Exposes the endpoint through ${name}.`
        }
        chips={
          <>
            {option.protocols.map(p => (
              <Chip key={p} label={p} size="small" variant="outlined" />
            ))}
            {option.entry.default && (
              <Chip label="Default" size="small" color="primary" />
            )}
            {option.entry.name && (
              <Chip label={option.entry.name} size="small" />
            )}
          </>
        }
        onClick={() => onSelect(option.key)}
      />
    );
  };

  // Brings the panel into view when it opens below a long list.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) panelRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [open]);

  if (!open) return null;
  return (
    <div
      className={classes.panel}
      role="region"
      aria-labelledby="endpoint-type-picker-title"
      ref={panelRef}
    >
      <Box className={classes.panelHeader}>
        <Box>
          <Typography
            id="endpoint-type-picker-title"
            className={classes.heading}
          >
            Add an endpoint
          </Typography>
          <Typography variant="body2" className={classes.intro}>
            Choose how the endpoint is exposed. The Endpoint type decides the
            protocols it supports and the settings it asks for next.
          </Typography>
        </Box>
        <Button size="small" onClick={onClose}>
          Cancel
        </Button>
      </Box>
      <Box className={classes.grid}>
        {options.map(typeCard)}
        <TypeCard
          icon={<LockOutlinedIcon />}
          muted
          name="Project only"
          description="Reachable by components in this project only. No Endpoint is created."
          chips={<Chip label="Any protocol" size="small" variant="outlined" />}
          onClick={() => onSelect(NO_ENDPOINT)}
        />
      </Box>
    </div>
  );
};
