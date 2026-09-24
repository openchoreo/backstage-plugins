import { useEffect } from 'react';
import { TextField, MenuItem, Grid, Typography } from '@material-ui/core';
import { useRepoCreationStyles } from './styles';
import type { GitSourceData } from './GitSourceField';

export interface RepoProviderOption {
  provider: string;
  host: string;
}

export interface RepoCreationConfig {
  providers: RepoProviderOption[];
  // 'config' → curated runtime dropdown; 'url' → optional starter URL field.
  starterMode?: 'config' | 'url';
  runtimes?: string[];
}

interface Props {
  data: GitSourceData;
  config: RepoCreationConfig;
  onChange: (next: GitSourceData) => void;
  hasError?: boolean;
}

const VISIBILITIES = ['private', 'public'];

/** Build the scaffolder publish `repoUrl` (`host?owner=..&repo=..`). */
const buildRepoUrl = (host: string, owner: string, repo: string): string =>
  host && owner && repo
    ? `${host}?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(
        repo,
      )}`
    : '';

/**
 * Fields for creating a new repository. Provider/host drive which publish
 * action runs; owner + name build the publish `repoUrl`.
 */
export const RepoCreationFields = ({
  data,
  config,
  onChange,
  hasError,
}: Props) => {
  const classes = useRepoCreationStyles();
  const { providers, runtimes = [] } = config;
  const starterMode = config.starterMode ?? 'url';

  // Default to the only host when there's exactly one.
  const host =
    data.repo_host || (providers.length === 1 ? providers[0].host : '');
  const providerOf = (h: string) =>
    providers.find(p => p.host === h)?.provider ?? '';

  const update = (patch: Partial<GitSourceData>) => {
    const next = { ...data, ...patch };
    const nextHost = next.repo_host || '';
    next.provider = providerOf(nextHost);
    next.repoUrl = buildRepoUrl(
      nextHost,
      next.owner ?? '',
      next.repo_name ?? '',
    );
    onChange(next);
  };

  // Seed provider/host once when there's a single configured provider.
  useEffect(() => {
    if (providers.length === 1 && data.repo_host !== providers[0].host) {
      update({ repo_host: providers[0].host });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers, data.repo_host]);

  return (
    <Grid container spacing={2}>
      {providers.length > 1 && (
        <Grid item xs={12}>
          <TextField
            select
            label="Git Provider"
            value={host}
            onChange={e => update({ repo_host: e.target.value })}
            fullWidth
            variant="outlined"
            required
            error={hasError && !host}
            helperText="Where the new repository is created"
          >
            {providers.map(p => (
              <MenuItem key={p.host} value={p.host}>
                {p.host} ({p.provider})
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      )}

      <Grid item xs={12} sm={6}>
        <TextField
          label="Owner / Organization"
          value={data.owner ?? ''}
          onChange={e => update({ owner: e.target.value })}
          fullWidth
          variant="outlined"
          required
          error={hasError && !data.owner}
          helperText="Org or user that will own the repo"
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          label="Repository Name"
          value={data.repo_name ?? ''}
          onChange={e => update({ repo_name: e.target.value })}
          fullWidth
          variant="outlined"
          required
          error={hasError && !data.repo_name}
          helperText="Name of the repository to create"
        />
      </Grid>

      <Grid item xs={12} sm={starterMode === 'config' ? 6 : 12}>
        <TextField
          select
          label="Visibility"
          value={data.visibility || 'private'}
          onChange={e => update({ visibility: e.target.value })}
          fullWidth
          variant="outlined"
        >
          {VISIBILITIES.map(v => (
            <MenuItem key={v} value={v}>
              {v}
            </MenuItem>
          ))}
        </TextField>
      </Grid>

      {/* Config mode: pick a curated starter. */}
      {starterMode === 'config' && (
        <Grid item xs={12} sm={6}>
          <TextField
            select
            label="Starter Template"
            value={data.runtime ?? ''}
            onChange={e => update({ runtime: e.target.value })}
            fullWidth
            variant="outlined"
            required
            error={hasError && !data.runtime}
            helperText="Seeds the repo with buildable source"
          >
            {runtimes.map(r => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      )}

      {/* URL mode: optional starter repo; blank creates an empty repo. */}
      {starterMode === 'url' && (
        <Grid item xs={12}>
          <TextField
            label="Starter Template URL (optional)"
            value={data.starter_url ?? ''}
            onChange={e => update({ starter_url: e.target.value })}
            fullWidth
            variant="outlined"
            placeholder="https://github.com/org/starter/tree/main"
            helperText="Files are copied into the new repo. Leave blank to create an empty repository."
          />
        </Grid>
      )}

      {data.repoUrl && (
        <Grid item xs={12}>
          <Typography variant="caption" className={classes.hint}>
            Will create: {host}/{data.owner}/{data.repo_name}
          </Typography>
        </Grid>
      )}
    </Grid>
  );
};
