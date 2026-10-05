import Grid from '@material-ui/core/Grid';
import { Content } from '@backstage/core-components';
import {
  UserSettingsProfileCard,
  UserSettingsAppearanceCard,
  UserSettingsIdentityCard,
} from '@backstage/plugin-user-settings';
import { PlatformAboutCard } from '@openchoreo/backstage-plugin';

export const OpenChoreoGeneralSettings = () => (
  <Content>
    <Grid container direction="row" spacing={3}>
      <Grid item xs={12} md={6}>
        <UserSettingsProfileCard />
      </Grid>
      <Grid item xs={12} md={6}>
        <UserSettingsAppearanceCard />
      </Grid>
      <Grid item xs={12} md={6}>
        <UserSettingsIdentityCard />
      </Grid>
      <Grid item xs={12} md={6}>
        <PlatformAboutCard />
      </Grid>
    </Grid>
  </Content>
);
