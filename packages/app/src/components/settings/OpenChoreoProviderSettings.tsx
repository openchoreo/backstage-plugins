import List from '@material-ui/core/List';
import { ProviderSettingsItem } from '@backstage/plugin-user-settings';
import { defaultIdpAuthApiRef } from '../../apis';
import { OpenChoreoIcon } from '@openchoreo/backstage-design-system';

export const OpenChoreoProviderSettings = () => {
  return (
    <List>
      <ProviderSettingsItem
        title="OpenChoreo IDP"
        description="Sign in with Thunder Identity Provider"
        icon={OpenChoreoIcon}
        apiRef={defaultIdpAuthApiRef}
      />
    </List>
  );
};
