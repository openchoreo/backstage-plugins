import Grid from '@material-ui/core/Grid';
import {
  SettingsLayout,
  UserSettingsProfileCard,
  UserSettingsAppearanceCard,
  UserSettingsIdentityCard,
} from '@backstage/plugin-user-settings';
import {
  AccessControlContent,
  PlatformAboutCard,
  SecretsContent,
} from '@openchoreo/backstage-plugin';

// Curated three-tab /settings page. Skips upstream's SubPageBlueprint
// collection (Auth Providers / Feature Flags don't appear).
export const OpenChoreoUserSettingsPage = () => (
  <SettingsLayout>
    <SettingsLayout.Route path="general" title="General">
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
    </SettingsLayout.Route>
    <SettingsLayout.Route path="access-control" title="Access Control">
      <AccessControlContent />
    </SettingsLayout.Route>
    <SettingsLayout.Route path="secrets" title="Secrets">
      <SecretsContent />
    </SettingsLayout.Route>
  </SettingsLayout>
);
