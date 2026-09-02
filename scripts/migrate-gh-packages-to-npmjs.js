#!/usr/bin/env node

/**
 * Migrate GitHub Packages -> public npm
 *
 * One-off migration used when `@openchoreo/*` moved from GitHub Packages
 * (https://npm.pkg.github.com) to the public npm registry. Committed for
 * auditability: it documents exactly which versions were copied and how.
 *
 * For every published package it copies each already-released version's
 * tarball from GitHub Packages to registry.npmjs.org, then replicates the
 * source registry's dist-tags.
 *
 * Why the tarballs are repacked instead of published as-is
 * --------------------------------------------------------
 * Every historical tarball embeds `publishConfig.registry:
 * https://npm.pkg.github.com` in its package.json. npm reads publishConfig
 * from *inside* the tarball and it beats the `--registry` CLI flag
 * (npm/cli#6400), so a naive `npm publish old.tgz --registry=...` would push
 * the tarball straight back to GitHub Packages. The only mutation this script
 * makes is deleting that one field; every other byte is preserved.
 *
 * Migrated versions carry no provenance attestation — they predate trusted
 * publishing. Only releases cut after the cutover are attested.
 *
 * Prerequisites
 * -------------
 *   GITHUB_PACKAGES_TOKEN  classic GitHub PAT with the `read:packages` scope.
 *                          Fine-grained tokens and the `gh` CLI token are
 *                          rejected by GitHub Packages.
 *   npm auth               an npm session with publish rights on the
 *                          @openchoreo org (`npm login`, or NPM_TOKEN in
 *                          ~/.npmrc). Needed only with --execute.
 *
 * Usage
 * -----
 *   node scripts/migrate-gh-packages-to-npmjs.js                 # dry run
 *   node scripts/migrate-gh-packages-to-npmjs.js --execute
 *   node scripts/migrate-gh-packages-to-npmjs.js --since 1.2.0
 *   node scripts/migrate-gh-packages-to-npmjs.js --only @openchoreo/cell-diagram
 *
 * Dry run is the default; nothing is published without --execute. The script
 * is idempotent — versions already present on npm are skipped, so a run
 * interrupted by a rate limit can simply be re-run.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const GH_REGISTRY = 'https://npm.pkg.github.com';
const NPM_REGISTRY = 'https://registry.npmjs.org';
const SCOPE = '@openchoreo';

// `--registry` alone is not enough: a scope-specific registry in any .npmrc
// (`@openchoreo:registry=...`) takes precedence over it for scoped packages
// (npm/npm#10117). Pin the scope explicitly so a stale GitHub Packages setting
// on the operator's machine cannot redirect a publish back to the old registry.
const REGISTRY_ARGS = [
  '--registry',
  NPM_REGISTRY,
  `--${SCOPE}:registry=${NPM_REGISTRY}`,
];

// Scratch dist-tag used while copying versions, removed once the real tags are
// replicated. Deliberately unlikely to collide with a tag the source registry
// actually uses.
const SCRATCH_TAG = 'x-migration-scratch';

// Versions below this floor stay on GitHub Packages only. 1.1.0 is the oldest
// line the published docs still reference.
const DEFAULT_SINCE = '1.1.0';

// ---------------------------------------------------------------------------
// semver (just enough: compare + precedence-aware prerelease handling)
// ---------------------------------------------------------------------------

function parseVersion(v) {
  const m =
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(v);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ? m[4].split('.') : [],
  };
}

function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return a.localeCompare(b);

  for (const k of ['major', 'minor', 'patch']) {
    if (pa[k] !== pb[k]) return pa[k] - pb[k];
  }

  // A version without a prerelease outranks one with it (1.0.0 > 1.0.0-rc.1).
  if (pa.prerelease.length === 0 && pb.prerelease.length > 0) return 1;
  if (pa.prerelease.length > 0 && pb.prerelease.length === 0) return -1;

  const len = Math.max(pa.prerelease.length, pb.prerelease.length);
  for (let i = 0; i < len; i++) {
    const x = pa.prerelease[i];
    const y = pb.prerelease[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xNum = /^\d+$/.test(x);
    const yNum = /^\d+$/.test(y);
    if (xNum && yNum) {
      if (Number(x) !== Number(y)) return Number(x) - Number(y);
    } else if (xNum !== yNum) {
      return xNum ? -1 : 1; // numeric identifiers rank lower than alphanumeric
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// registries
// ---------------------------------------------------------------------------

/**
 * Node's fetch reports every transport-level failure as the opaque message
 * "fetch failed" and hides the real reason (ECONNRESET, ETIMEDOUT, socket hang
 * up) on `err.cause`. Unwrap it so a failed migration says what went wrong, and
 * retry, since these are transient and a run copies hundreds of tarballs.
 */
function describeError(err) {
  const parts = [err.message];
  for (let cause = err.cause; cause; cause = cause.cause) {
    const detail = cause.code || cause.message;
    if (detail && !parts.includes(detail)) parts.push(detail);
  }
  return parts.join(': ');
}

const MAX_ATTEMPTS = 4;

async function fetchWithRetry(url, options, label) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastError = err;
      if (attempt === MAX_ATTEMPTS) break;
      const backoffMs = 1000 * 2 ** (attempt - 1);
      console.log(
        `  ${label}: ${describeError(err)} — retry ${attempt}/${
          MAX_ATTEMPTS - 1
        } in ${backoffMs}ms`,
      );
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
  throw new Error(`GET ${url} failed: ${describeError(lastError)}`);
}

async function fetchJson(url, token) {
  const headers = { accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetchWithRetry(url, { headers }, 'metadata');
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** Package names to migrate: the `linked` group in the changeset config. */
function publishedPackageNames() {
  const config = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '..', '.changeset', 'config.json'),
      'utf8',
    ),
  );
  return (config.linked || []).flat();
}

// ---------------------------------------------------------------------------
// tarball repack
// ---------------------------------------------------------------------------

/**
 * Download `tarballUrl`, strip `publishConfig.registry` from its package.json,
 * and repack. Returns the path of the rewritten tarball inside `workDir`.
 */
async function repackTarball(tarballUrl, token, workDir) {
  const res = await fetchWithRetry(
    tarballUrl,
    { headers: { authorization: `Bearer ${token}` } },
    'tarball',
  );
  if (!res.ok) {
    throw new Error(`GET ${tarballUrl} -> ${res.status} ${res.statusText}`);
  }

  const original = path.join(workDir, 'original.tgz');
  fs.writeFileSync(original, Buffer.from(await res.arrayBuffer()));

  const extractDir = path.join(workDir, 'extract');
  fs.mkdirSync(extractDir, { recursive: true });
  execFileSync('tar', ['-xzf', original, '-C', extractDir]);

  const manifestPath = path.join(extractDir, 'package', 'package.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`tarball has no package/package.json: ${tarballUrl}`);
  }

  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  if (manifest.publishConfig) {
    delete manifest.publishConfig.registry;
    if (Object.keys(manifest.publishConfig).length === 0) {
      delete manifest.publishConfig;
    }
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const repacked = path.join(workDir, 'repacked.tgz');
  execFileSync('tar', [
    '-czf',
    repacked,
    '-C',
    extractDir,
    '--sort=name',
    '--owner=0',
    '--group=0',
    '--numeric-owner',
    'package',
  ]);
  return repacked;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { execute: false, since: DEFAULT_SINCE, only: null };
  const requireValue = (flag, value) => {
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${flag} requires a value`);
    }
    return value;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--execute') args.execute = true;
    else if (a === '--since') args.since = requireValue(a, argv[++i]);
    else if (a === '--only') args.only = requireValue(a, argv[++i]);
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  // An unparseable floor would silently fall back to lexical comparison in
  // compareVersions and migrate the wrong set of versions.
  if (!parseVersion(args.since)) {
    throw new Error(`--since must be a semver version, got: ${args.since}`);
  }
  return args;
}

async function migratePackage(name, args, token, summary) {
  const encoded = name.replace('/', '%2f');

  const source = await fetchJson(`${GH_REGISTRY}/${encoded}`, token);
  if (!source) {
    console.log(`  not on GitHub Packages — skipping`);
    summary.push({ name, published: 0, skipped: 0, note: 'absent upstream' });
    return;
  }

  const target = await fetchJson(`${NPM_REGISTRY}/${encoded}`);
  const onNpm = new Set(Object.keys((target && target.versions) || {}));

  const candidates = Object.keys(source.versions || {})
    .filter(v => parseVersion(v))
    .filter(v => compareVersions(v, args.since) >= 0)
    .sort(compareVersions);

  const belowFloor =
    Object.keys(source.versions || {}).length - candidates.length;
  const todo = candidates.filter(v => !onNpm.has(v));

  console.log(
    `  ${candidates.length} version(s) >= ${args.since}` +
      ` (${belowFloor} below floor, not migrated),` +
      ` ${candidates.length - todo.length} already on npm,` +
      ` ${todo.length} to publish`,
  );

  let published = 0;
  for (const version of todo) {
    const dist = source.versions[version].dist || {};
    if (!dist.tarball) {
      console.log(`  ! ${version}: no tarball url — skipping`);
      continue;
    }
    if (!args.execute) {
      console.log(`  would publish ${version}`);
      continue;
    }

    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-migrate-'));
    try {
      const tgz = await repackTarball(dist.tarball, token, workDir);
      // The scratch tag keeps every intermediate publish off `latest`; the
      // real dist-tags are replicated from the source registry once all
      // versions have landed.
      execFileSync(
        'npm',
        ['publish', tgz, '--access', 'public', '--tag', SCRATCH_TAG].concat(
          REGISTRY_ARGS,
        ),
        { stdio: 'inherit' },
      );
      published++;
      console.log(`  published ${version}`);
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  }

  // Replicate the source registry's dist-tags, skipping any that point below
  // the migration floor (those versions do not exist on npm).
  const sourceTags = source['dist-tags'] || {};
  const tagPlan = [];
  for (const [tag, version] of Object.entries(sourceTags)) {
    if (compareVersions(version, args.since) < 0) {
      console.log(
        `  ! dist-tag ${tag} -> ${version} is below the floor — not replicated`,
      );
      continue;
    }
    tagPlan.push([tag, version]);
  }

  for (const [tag, version] of tagPlan) {
    if (!args.execute) {
      console.log(`  would set dist-tag ${tag} -> ${version}`);
      continue;
    }
    execFileSync(
      'npm',
      ['dist-tag', 'add', `${name}@${version}`, tag].concat(REGISTRY_ARGS),
      { stdio: 'inherit' },
    );
  }

  // Always attempt the cleanup, not just when this run published something — a
  // resumed run can inherit a scratch tag from an earlier attempt that
  // published versions but did not reach this point. Absence is fine. Guard
  // against the unlikely case where the source registry genuinely uses this
  // tag name, which the replication above would then have recreated.
  if (args.execute && !(SCRATCH_TAG in sourceTags)) {
    try {
      execFileSync(
        'npm',
        ['dist-tag', 'rm', name, SCRATCH_TAG].concat(REGISTRY_ARGS),
        { stdio: 'pipe' },
      );
      console.log(`  removed scratch dist-tag: ${SCRATCH_TAG}`);
    } catch {
      // no scratch tag on this package — nothing to clean up
    }
  }

  summary.push({
    name,
    published: args.execute ? published : todo.length,
    skipped: candidates.length - todo.length,
    tags: tagPlan.map(([t, v]) => `${t}=${v}`).join(' '),
  });
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    // Usage errors are the operator's typo, not a crash — no stack trace.
    console.error(`${err.message}\n`);
    console.error('Usage: node scripts/migrate-gh-packages-to-npmjs.js \\');
    console.error('         [--execute] [--since <semver>] [--only <package>]');
    process.exit(2);
  }
  if (args.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
    return;
  }

  const token = process.env.GITHUB_PACKAGES_TOKEN;
  if (!token) {
    console.error(
      'GITHUB_PACKAGES_TOKEN is required (classic PAT with read:packages).',
    );
    process.exit(1);
  }

  let names = publishedPackageNames();
  if (args.only) {
    names = names.filter(n => n === args.only);
    if (names.length === 0) {
      console.error(`--only ${args.only} matched no published package`);
      process.exit(1);
    }
  }

  console.log(
    `${args.execute ? 'MIGRATING' : 'DRY RUN'}: ${names.length} package(s), ` +
      `versions >= ${args.since}\n`,
  );

  const summary = [];
  const failures = [];
  for (const name of names) {
    console.log(name);
    try {
      await migratePackage(name, args, token, summary);
    } catch (err) {
      const detail = describeError(err);
      console.error(`  FAILED: ${detail}`);
      failures.push({ name, error: detail });
    }
    console.log('');
  }

  console.log('--- summary ---');
  for (const row of summary) {
    console.log(
      `${row.name}: ${row.published} ${
        args.execute ? 'published' : 'pending'
      }` +
        `, ${row.skipped} already present` +
        (row.note ? ` (${row.note})` : '') +
        (row.tags ? ` [${row.tags}]` : ''),
    );
  }
  if (failures.length > 0) {
    console.log('');
    for (const f of failures) console.log(`FAILED ${f.name}: ${f.error}`);
    process.exit(1);
  }
  if (!args.execute) {
    console.log('\nDry run only. Re-run with --execute to publish.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
