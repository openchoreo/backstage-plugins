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
import VerifiedUserIcon from '@material-ui/icons/VerifiedUser';

// Single source of truth for OpenChoreo platform kind icons. Consumed
// twice: `IconBundleBlueprint` (kind:x-keyed shape via LEGACY_KIND_ICONS)
// and `DefaultEntityPresentationApi.kindIcons` (bare-x shape).

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
  // Deployment hooks (alpha): a gate that must pass before a deploy proceeds.
  // Distinct from AccountTreeIcon (deploymentpipeline) and
  // PlayCircleOutlineIcon (workflow) on purpose — all three appear side by
  // side under "Platform Configuration" and must stay tellable apart.
  hook: VerifiedUserIcon,
  clusterhook: VerifiedUserIcon,
  workflow: PlayCircleOutlineIcon,
  clusterworkflow: PlayCircleOutlineIcon,
  componentworkflow: SettingsApplicationsIcon,
};

/** kind:x-keyed shape consumed by IconBundleBlueprint (see portalPlugin.tsx). */
export const LEGACY_KIND_ICONS = Object.fromEntries(
  Object.entries(KIND_ICONS).map(([k, v]) => [`kind:${k}`, v]),
);
