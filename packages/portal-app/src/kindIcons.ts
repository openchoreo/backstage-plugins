import type { IconComponent } from '@backstage/core-plugin-api';
import CloudIcon from '@material-ui/icons/Cloud';
import NotificationsIcon from '@material-ui/icons/Notifications';
import DnsIcon from '@material-ui/icons/Dns';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import VisibilityIcon from '@material-ui/icons/Visibility';
import BuildIcon from '@material-ui/icons/Build';
import CategoryIcon from '@material-ui/icons/Category';
import LayersIcon from '@material-ui/icons/Layers';
import StorageIcon from '@material-ui/icons/Storage';
import ExtensionIcon from '@material-ui/icons/Extension';
import PlayCircleOutlineIcon from '@material-ui/icons/PlayCircleOutline';
import SettingsApplicationsIcon from '@material-ui/icons/SettingsApplications';

/**
 * Single source of truth for OpenChoreo platform kind icons. Both
 * `App.tsx` (legacy `convertLegacyAppOptions.icons` shape, `kind:<x>`)
 * and `customOverrides.tsx` (NFS `DefaultEntityPresentationApi.kindIcons`
 * shape, bare `<x>`) derive their respective keyed shapes from this map.
 */
export const KIND_ICONS: Record<string, IconComponent> = {
  environment: CloudIcon,
  observabilityalertsnotificationchannel: NotificationsIcon,
  dataplane: DnsIcon,
  clusterdataplane: DnsIcon,
  deploymentpipeline: AccountTreeIcon,
  observabilityplane: VisibilityIcon,
  clusterobservabilityplane: VisibilityIcon,
  workflowplane: BuildIcon,
  clusterworkflowplane: BuildIcon,
  componenttype: CategoryIcon,
  clustercomponenttype: CategoryIcon,
  resourcetype: LayersIcon,
  clusterresourcetype: LayersIcon,
  projecttype: CategoryIcon,
  clusterprojecttype: CategoryIcon,
  resource: StorageIcon,
  traittype: ExtensionIcon,
  clustertraittype: ExtensionIcon,
  workflow: PlayCircleOutlineIcon,
  clusterworkflow: PlayCircleOutlineIcon,
  componentworkflow: SettingsApplicationsIcon,
};

/** `kind:<x>`-keyed shape consumed by `convertLegacyAppOptions.icons`. */
export const LEGACY_KIND_ICONS = Object.fromEntries(
  Object.entries(KIND_ICONS).map(([k, v]) => [`kind:${k}`, v]),
);
