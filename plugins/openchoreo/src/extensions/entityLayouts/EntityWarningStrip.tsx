import Grid from '@material-ui/core/Grid';
import {
  EntityOrphanWarning,
  EntityProcessingErrorsPanel,
  EntitySwitch,
  hasCatalogProcessingErrors,
  isOrphan,
  hasRelationWarnings,
} from '@backstage/plugin-catalog';
import { EntityRelationWarning } from '../../components/EntityRelationWarning';

/**
 * The warning bar rendered at the top of every OC Overview layout. Groups
 * the three EntitySwitch cases we historically inlined into `EntityPage.tsx`:
 * orphan, unresolved relations, catalog processing errors. Each renders as a
 * full-width `<Grid item>` so it slots into the parent Grid without special
 * casing.
 */
export function EntityWarningStrip() {
  return (
    <>
      <EntitySwitch>
        <EntitySwitch.Case if={isOrphan}>
          <Grid item xs={12}>
            <EntityOrphanWarning />
          </Grid>
        </EntitySwitch.Case>
      </EntitySwitch>
      <EntitySwitch>
        <EntitySwitch.Case if={hasRelationWarnings}>
          <Grid item xs={12}>
            <EntityRelationWarning />
          </Grid>
        </EntitySwitch.Case>
      </EntitySwitch>
      <EntitySwitch>
        <EntitySwitch.Case if={hasCatalogProcessingErrors}>
          <Grid item xs={12}>
            <EntityProcessingErrorsPanel />
          </Grid>
        </EntitySwitch.Case>
      </EntitySwitch>
    </>
  );
}
