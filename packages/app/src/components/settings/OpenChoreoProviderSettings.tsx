import List from '@material-ui/core/List';
import { ProviderSettingsItem } from '@backstage/plugin-user-settings';
import { openChoreoAuthApiRef } from '../../apis';
import { OpenChoreoIcon } from '@openchoreo/backstage-design-system';

export const OpenChoreoProviderSettings = () => {
  return (
    <List>
      <ProviderSettingsItem
        title="OpenChoreo"
        description="Sign in with OpenChoreo Identity Provider"
        icon={OpenChoreoIcon}
        apiRef={openChoreoAuthApiRef}
      />
    </List>
  );
};
