#!/usr/bin/env node

/**
 * Portal template generator
 *
 * Renders `templates/default-portal/` — the scaffold that `create-portal`
 * ships inside its npm tarball and that the release workflow pushes to the
 * `openchoreo/portal-template` repo — from the LIVE monorepo in three passes:
 *
 *   1. Verbatim copies of monorepo files (configs, assets, scaffolder
 *      templates). Self-healing: monorepo edits flow into the template on the
 *      next generation with no manual sync.
 *   2. Transforms of monorepo files (package.jsons, backend index) that pin
 *      versions and strip the private Portal Assistant wiring.
 *   3. Owned overrides from `templates-src/` for files that deliberately
 *      differ from the monorepo (App.tsx without the assistant, README,
 *      upgrade anchor).
 *
 * Version pinning: every `workspace:^` dependency on an `@openchoreo/*`
 * package becomes `^<create-portal's own version>`. This is correct because
 * the release process (scripts/set-version.js) stamps every workspace to one
 * exact version before publish — one number identifies the whole release.
 *
 * The generator fails loudly on drift: missing strip markers in the backend
 * index, or any private-package reference surviving into the output.
 */

const fs = require('fs');
const path = require('path');

const PKG_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PKG_DIR, '../..');
const TEMPLATES_SRC = path.join(PKG_DIR, 'templates-src');

const ASSISTANT_PACKAGE_PREFIX =
  '@openchoreo/backstage-plugin-openchoreo-portal-assistant';
// Marks monorepo-only blocks (the private assistant's wiring and config) that
// the generator cuts from the scaffold. Written as a `//` or `#` comment.
const STRIP_START = 'portal-template:strip-start';
const STRIP_END = 'portal-template:strip-end';
const STRIP_BLOCK = new RegExp(
  `[\\t ]*(?://|#) ${STRIP_START}[\\s\\S]*?(?://|#) ${STRIP_END}\\n?`,
  'g',
);

/** Removes every strip-marked block, collapsing the blank lines left behind. */
function stripMarkedBlocks(text) {
  return text.replace(STRIP_BLOCK, '').replace(/\n{3,}/g, '\n\n');
}

// Private workspaces that stay part of the scaffold itself (they are the
// scaffold) — everything else that is `private: true` gets dropped.
const SCAFFOLD_LOCAL_WORKSPACES = new Set(['app', 'backend']);

// Monorepo root files copied verbatim.
const ROOT_FILES = [
  'backstage.json',
  'tsconfig.json',
  'playwright.config.ts',
  'app-config.yaml',
  'app-config.production.yaml',
  'app-config.local.yaml.example',
  '.dockerignore',
  '.eslintignore',
  '.eslintrc.js',
  '.prettierignore',
];

// Monorepo directories copied verbatim. `templates/` are Backstage
// scaffolder templates full of `${{ parameters.* }}` — they must NEVER get an
// `.hbs` suffix or handlebars would mangle them at scaffold time.
const ROOT_DIRS = ['catalog-entities', 'examples', 'templates'];

// Root package.json scripts that make sense in a scaffolded portal (release
// and changeset machinery stays behind in the monorepo).
const ROOT_SCRIPT_ALLOWLIST = [
  'start',
  'build:backend',
  'build:all',
  'build-image',
  'tsc',
  'tsc:full',
  'clean',
  'test',
  'test:all',
  'test:e2e',
  'test:e2e:a11y',
  'fix',
  'lint:all',
  'prettier:check',
  'prettier:write',
];

// packages/app source files NOT copied: the owned App.tsx/App.test.tsx from
// templates-src replace the monorepo ones (which wire the private assistant),
// and the assistant module itself is dropped entirely.
const APP_SRC_EXCLUDE = new Set([
  'App.tsx',
  'App.test.tsx',
  'assistant.tsx',
  'assistant.test.tsx',
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeFileEnsured(dest, contents) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, contents);
}

function copyFileEnsured(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest, { exclude = () => false } = {}) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (exclude(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to, {});
    } else {
      copyFileEnsured(from, to);
    }
  }
}

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

/** Map of workspace package name -> { private } across packages/* plugins/*. */
function readWorkspaceIndex() {
  const index = new Map();
  for (const group of ['packages', 'plugins']) {
    const groupDir = path.join(REPO_ROOT, group);
    for (const dir of fs.readdirSync(groupDir)) {
      const manifestPath = path.join(groupDir, dir, 'package.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = readJson(manifestPath);
        index.set(manifest.name, { private: manifest.private === true });
      }
    }
  }
  return index;
}

/**
 * Rewrites a dependency block: drops deps on private workspaces (except the
 * scaffold's own local ones) and pins remaining `workspace:^` deps to the
 * CLI's version.
 */
function transformDeps(deps, workspaceIndex, cliVersion) {
  if (!deps) return deps;
  const out = {};
  for (const [name, range] of Object.entries(deps)) {
    const workspace = workspaceIndex.get(name);
    if (workspace?.private && !SCAFFOLD_LOCAL_WORKSPACES.has(name)) {
      continue;
    }
    if (typeof range === 'string' && range.startsWith('workspace:')) {
      out[name] = SCAFFOLD_LOCAL_WORKSPACES.has(name)
        ? 'workspace:^'
        : `^${cliVersion}`;
    } else {
      out[name] = range;
    }
  }
  return out;
}

function transformPackageManifest(manifest, workspaceIndex, cliVersion) {
  const out = { ...manifest, version: '0.1.0' };
  delete out.repository;
  for (const field of ['dependencies', 'devDependencies']) {
    if (out[field]) {
      out[field] = transformDeps(out[field], workspaceIndex, cliVersion);
    }
  }
  return out;
}

/** Package names a source file imports (relative imports ignored). */
function importedPackages(source) {
  const names = new Set();
  const specifier =
    /(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;
  for (const [, spec] of source.matchAll(specifier)) {
    if (spec.startsWith('.')) continue;
    const parts = spec.split('/');
    names.add(spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]);
  }
  return names;
}

/**
 * Drops app dependencies that only the excluded host-wiring files (the
 * monorepo App.tsx and the assistant module) import. Derived from the actual
 * imports so new assistant wiring in the monorepo never leaks unused
 * dependencies into the scaffold.
 */
function pruneHostOnlyDeps(manifest, excludedSources, scaffoldSources) {
  const excludedImports = new Set(
    excludedSources.flatMap(s => [...importedPackages(s)]),
  );
  const scaffoldImports = new Set(
    scaffoldSources.flatMap(s => [...importedPackages(s)]),
  );
  const dependencies = Object.fromEntries(
    Object.entries(manifest.dependencies ?? {}).filter(
      ([name]) => !excludedImports.has(name) || scaffoldImports.has(name),
    ),
  );
  return { ...manifest, dependencies };
}

function toJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function generateTemplate({
  outputDir = path.join(PKG_DIR, 'templates', 'default-portal'),
} = {}) {
  const cliVersion = readJson(path.join(PKG_DIR, 'package.json')).version;
  const workspaceIndex = readWorkspaceIndex();

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  // --- Pass 1: verbatim copies -------------------------------------------

  for (const file of ROOT_FILES) {
    const src = path.join(REPO_ROOT, file);
    if (!fs.existsSync(src)) {
      throw new Error(
        `Expected monorepo file missing: ${file} — update the generator manifest`,
      );
    }
    const dest = path.join(outputDir, file);
    if (/\.ya?ml(\.example)?$/.test(file)) {
      // App configs carry strip-marked monorepo-only settings (the private
      // assistant's upstream URL); everything else copies as-is.
      writeFileEnsured(dest, stripMarkedBlocks(fs.readFileSync(src, 'utf8')));
    } else {
      copyFileEnsured(src, dest);
    }
  }

  // npm pack strips bare .gitignore files from tarballs, so ship it with an
  // .hbs suffix that the scaffolding step removes (same trick as
  // @backstage/create-app).
  copyFileEnsured(
    path.join(REPO_ROOT, '.gitignore'),
    path.join(outputDir, '.gitignore.hbs'),
  );

  for (const dir of ROOT_DIRS) {
    copyDir(path.join(REPO_ROOT, dir), path.join(outputDir, dir));
  }
  copyDir(
    path.join(REPO_ROOT, '.yarn/releases'),
    path.join(outputDir, '.yarn/releases'),
  );

  // Seed lockfile: the scaffold installs the exact dependency set this
  // release was built and tested with, instead of whatever is newest on the
  // registry that day (a broken upstream publish would otherwise break every
  // fresh scaffold). Yarn prunes the monorepo-only entries on first install
  // and resolves the published @openchoreo/* packages from the registry.
  //
  // Workspace entries are dropped: they describe the monorepo's own packages
  // (including private ones), and Yarn regenerates the scaffold's workspace
  // entries on install.
  writeFileEnsured(
    path.join(outputDir, 'yarn.lock'),
    fs
      .readFileSync(path.join(REPO_ROOT, 'yarn.lock'), 'utf8')
      .split(/\n\n/)
      .filter(block => !/^ {2}resolution: ".*@workspace:/m.test(block))
      .join('\n\n'),
  );

  // packages/app — everything except the assistant wiring and the files the
  // owned overrides replace.
  const appDir = path.join(REPO_ROOT, 'packages/app');
  copyDir(path.join(appDir, 'src'), path.join(outputDir, 'packages/app/src'), {
    exclude: name => APP_SRC_EXCLUDE.has(name),
  });
  copyDir(
    path.join(appDir, 'public'),
    path.join(outputDir, 'packages/app/public'),
  );
  copyDir(
    path.join(appDir, 'e2e-tests'),
    path.join(outputDir, 'packages/app/e2e-tests'),
  );
  for (const file of ['.eslintrc.js', '.eslintignore']) {
    const src = path.join(appDir, file);
    if (fs.existsSync(src)) {
      copyFileEnsured(src, path.join(outputDir, 'packages/app', file));
    }
  }

  // packages/backend — sources are transformed below; configs and the
  // Dockerfile copy verbatim (npmjs needs no auth, so the monorepo image
  // build works unchanged in a scaffold).
  const backendDir = path.join(REPO_ROOT, 'packages/backend');
  for (const file of ['.eslintrc.js', 'README.md', 'Dockerfile']) {
    const src = path.join(backendDir, file);
    if (fs.existsSync(src)) {
      copyFileEnsured(src, path.join(outputDir, 'packages/backend', file));
    }
  }

  // --- Pass 2: transforms -------------------------------------------------

  // Root package.json -> package.json.hbs ({{name}} filled at scaffold time).
  const rootManifest = readJson(path.join(REPO_ROOT, 'package.json'));
  const templateRoot = {
    ...rootManifest,
    name: '{{name}}',
    version: '0.1.0',
  };
  delete templateRoot.repository;
  delete templateRoot['lint-staged'];
  templateRoot.scripts = Object.fromEntries(
    ROOT_SCRIPT_ALLOWLIST.filter(k => rootManifest.scripts[k]).map(k => [
      k,
      rootManifest.scripts[k],
    ]),
  );
  if (templateRoot.devDependencies) {
    templateRoot.devDependencies = { ...templateRoot.devDependencies };
    delete templateRoot.devDependencies['@changesets/cli'];
  }
  writeFileEnsured(
    path.join(outputDir, 'package.json.hbs'),
    toJson(templateRoot),
  );

  // Workspace manifests with pinned @openchoreo/* versions.
  writeFileEnsured(
    path.join(outputDir, 'packages/app/package.json'),
    toJson(
      transformPackageManifest(
        readJson(path.join(appDir, 'package.json')),
        workspaceIndex,
        cliVersion,
      ),
    ),
  );
  writeFileEnsured(
    path.join(outputDir, 'packages/backend/package.json'),
    toJson(
      transformPackageManifest(
        readJson(path.join(backendDir, 'package.json')),
        workspaceIndex,
        cliVersion,
      ),
    ),
  );

  // Backend index with the private assistant block stripped.
  const backendIndexPath = path.join(backendDir, 'src/index.ts');
  const backendIndex = fs.readFileSync(backendIndexPath, 'utf8');
  if (
    !backendIndex.includes(STRIP_START) ||
    !backendIndex.includes(STRIP_END)
  ) {
    throw new Error(
      `Strip markers not found in ${backendIndexPath} — the generator can no ` +
        `longer separate the private assistant backend from the scaffold. ` +
        `Restore the "${STRIP_START}" / "${STRIP_END}" comments.`,
    );
  }
  writeFileEnsured(
    path.join(outputDir, 'packages/backend/src/index.ts'),
    stripMarkedBlocks(backendIndex),
  );

  // .yarnrc.yml -> .yarnrc.yml.hbs: the monorepo config plus the scoped
  // registry knob ({{registry}} filled at scaffold time). Derived from the
  // live file so a yarn version bump flows through automatically.
  //
  // The monorepo age-gates freshly published npm versions
  // (npmMinimalAgeGate), but the scaffold pins @openchoreo/* versions
  // published the same day as the CLI — pre-approve the scope so a
  // release-day `yarn install` (and the release workflow's scaffold smoke
  // test, minutes after publish) isn't refused. Every other dependency
  // keeps the age gate.
  let yarnrc = fs
    .readFileSync(path.join(REPO_ROOT, '.yarnrc.yml'), 'utf8')
    .trimEnd();
  if (/^npmPreapprovedPackages:$/m.test(yarnrc)) {
    yarnrc = yarnrc.replace(
      /^npmPreapprovedPackages:$/m,
      `npmPreapprovedPackages:\n  - '@openchoreo/*'`,
    );
  } else if (yarnrc.includes('npmMinimalAgeGate')) {
    yarnrc += `\n\nnpmPreapprovedPackages:\n  - '@openchoreo/*'`;
  }
  writeFileEnsured(
    path.join(outputDir, '.yarnrc.yml.hbs'),
    `${yarnrc}\n\n` +
      `npmScopes:\n` +
      `  openchoreo:\n` +
      `    npmRegistryServer: '{{registry}}'\n` +
      // Only rendered for a plain-http --registry, which Yarn otherwise refuses.
      `{{#if unsafeHttpHost}}\n` +
      `\nunsafeHttpWhitelist:\n` +
      `  - '{{unsafeHttpHost}}'\n` +
      `{{/if}}\n`,
  );

  // --- Pass 3: owned overrides -------------------------------------------

  copyDir(TEMPLATES_SRC, outputDir);

  // Now that the scaffold's own app sources are final, prune the app manifest
  // of dependencies that only the excluded host wiring needed.
  const appManifestPath = path.join(outputDir, 'packages/app/package.json');
  const scaffoldAppDir = path.join(outputDir, 'packages/app');
  writeFileEnsured(
    appManifestPath,
    toJson(
      pruneHostOnlyDeps(
        readJson(appManifestPath),
        [...APP_SRC_EXCLUDE]
          .map(name => path.join(appDir, 'src', name))
          .filter(file => fs.existsSync(file))
          .map(file => fs.readFileSync(file, 'utf8')),
        listFiles(scaffoldAppDir)
          .filter(file => /\.[jt]sx?$/.test(file))
          .map(file => fs.readFileSync(file, 'utf8')),
      ),
    ),
  );

  // --- Self-checks --------------------------------------------------------

  const violations = [];
  for (const file of listFiles(outputDir)) {
    if (path.relative(outputDir, file).startsWith('.yarn/')) continue;
    const contents = fs.readFileSync(file, 'utf8');
    if (contents.includes(STRIP_START) || contents.includes(STRIP_END)) {
      violations.push(
        `${path.relative(outputDir, file)}: unbalanced ${STRIP_START} marker`,
      );
    }
    if (contents.includes(ASSISTANT_PACKAGE_PREFIX)) {
      violations.push(
        `${path.relative(outputDir, file)}: references the private ` +
          `${ASSISTANT_PACKAGE_PREFIX} package`,
      );
    }
    if (
      file.endsWith('package.json') &&
      !path.relative(outputDir, file).startsWith('templates/')
    ) {
      const manifest = JSON.parse(contents);
      for (const field of ['dependencies', 'devDependencies']) {
        for (const [name, range] of Object.entries(manifest[field] ?? {})) {
          if (
            String(range).startsWith('workspace:') &&
            !SCAFFOLD_LOCAL_WORKSPACES.has(name)
          ) {
            violations.push(
              `${path.relative(outputDir, file)}: unpinned workspace ` +
                `dependency ${name}`,
            );
          }
        }
      }
    }
  }
  if (violations.length > 0) {
    throw new Error(
      `Generated template failed self-checks:\n  ${violations.join('\n  ')}`,
    );
  }

  return { outputDir, cliVersion };
}

module.exports = { generateTemplate };

if (require.main === module) {
  const { outputDir, cliVersion } = generateTemplate();
  process.stdout.write(
    `Rendered portal template (release ${cliVersion}) at ${path.relative(
      process.cwd(),
      outputDir,
    )}\n`,
  );
}
