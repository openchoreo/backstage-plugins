#!/usr/bin/env node

/**
 * Set Version Script
 *
 * Forces the top-level `version` field of the root package.json and every
 * workspace package.json (packages/* and plugins/*) to an exact value.
 *
 * Used by prepare-next-version.yml AFTER `changeset version` has written
 * CHANGELOG entries and maintained .changeset/pre.json bookkeeping. In
 * pre-release mode Changesets computes a version like 1.2.0-next.0; we discard
 * that string and stamp the exact, clean version from the VERSION file (e.g.
 * 1.2.0-m1) so the downstream release-orchestrator "Validate VERSION file"
 * check passes and the git tag / npm publish use the milestone identifier the
 * operator chose.
 *
 * Only the top-level `version` field is rewritten. Internal @openchoreo/* deps
 * use `workspace:^`, which `changeset version` never rewrites and which Yarn
 * resolves to concrete versions at publish time, so dependency specifiers are
 * left untouched — with a defensive rewrite for any non-workspace internal pin
 * (a no-op today, future-proofing against someone pinning an internal dep).
 *
 * Usage: node scripts/set-version.js <version>
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

const VERSION = process.argv[2];
if (!VERSION || !/^\d+\.\d+\.\d+(-[A-Za-z0-9.-]+)?$/.test(VERSION)) {
  console.error(`ERROR: invalid or missing version argument: "${VERSION}"`);
  console.error('Usage: node scripts/set-version.js <version>');
  process.exit(1);
}

/**
 * Find all package.json files in the monorepo (root + packages/* + plugins/*)
 */
function findPackageJsonFiles() {
  const files = [path.join(ROOT_DIR, 'package.json')];

  const dirs = ['packages', 'plugins'];
  for (const dir of dirs) {
    const dirPath = path.join(ROOT_DIR, dir);
    if (fs.existsSync(dirPath)) {
      const subdirs = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const subdir of subdirs) {
        if (subdir.isDirectory()) {
          const pkgPath = path.join(dirPath, subdir.name, 'package.json');
          if (fs.existsSync(pkgPath)) {
            files.push(pkgPath);
          }
        }
      }
    }
  }

  return files;
}

/**
 * Replace the topmost `## ` heading of a changelog with `## <version>`.
 * Returns the new content, or null if there is nothing to change.
 */
function rewriteTopHeading(content, version) {
  const match = /^## (.*)$/m.exec(content);
  if (!match) return null;
  // Only touch headings that look like a version, never e.g. "## Unreleased".
  if (!/^\d+\.\d+\.\d+/.test(match[1])) return null;
  if (match[1] === version) return null; // idempotent
  return (
    content.slice(0, match.index) +
    `## ${version}` +
    content.slice(match.index + match[0].length)
  );
}

/**
 * CHANGELOG.md files that `changeset version` just modified or created.
 * Uses ls-files so brand-new (untracked) changelogs are included too.
 */
function findTouchedChangelogs() {
  const out = execFileSync(
    'git',
    [
      'ls-files',
      '--modified',
      '--others',
      '--exclude-standard',
      '--',
      'CHANGELOG.md',
      '*/CHANGELOG.md',
    ],
    { cwd: ROOT_DIR, encoding: 'utf-8' },
  );
  return [...new Set(out.split('\n').filter(Boolean))]
    .map(f => path.join(ROOT_DIR, f))
    .filter(f => fs.existsSync(f)); // --modified also lists deleted files
}

function fixChangelogHeadings() {
  const files = findTouchedChangelogs();
  let changed = 0;
  for (const file of files) {
    const next = rewriteTopHeading(fs.readFileSync(file, 'utf-8'), VERSION);
    if (next === null) continue;
    fs.writeFileSync(file, next);
    changed++;
    console.log(`   set heading ${path.relative(ROOT_DIR, file)} -> ${VERSION}`);
  }
  console.log(`set-version: updated ${changed} CHANGELOG.md heading(s)`);
}

/**
 * Main function
 */
function main() {
  console.log(`Set Version to ${VERSION}\n`);

  const packageFiles = findPackageJsonFiles();
  console.log(`Found ${packageFiles.length} package.json files\n`);

  let changed = 0;

  for (const pkgPath of packageFiles) {
    const relativePath = path.relative(ROOT_DIR, pkgPath);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    let dirty = false;

    if (pkg.version !== VERSION) {
      pkg.version = VERSION;
      dirty = true;
    }

    // Defensive: rewrite any internal @openchoreo/* dep that pins a concrete
    // version (NOT workspace:/link:) to ^VERSION. No-op today (all workspace:^).
    for (const field of DEP_FIELDS) {
      const deps = pkg[field];
      if (!deps) continue;
      for (const [name, range] of Object.entries(deps)) {
        if (!name.startsWith('@openchoreo/')) continue;
        if (range.startsWith('workspace:') || range.startsWith('link:'))
          continue;
        const next = `^${VERSION}`;
        if (deps[name] !== next) {
          deps[name] = next;
          dirty = true;
        }
      }
    }

    if (dirty) {
      // Preserve 2-space indent + trailing newline (matches repo convention;
      // prettier runs afterward to normalize anyway).
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      changed++;
      console.log(`   set ${relativePath} -> ${VERSION}`);
    }
  }

  console.log(
    `\nset-version: updated ${changed} package.json file(s) to ${VERSION}`,
  );
  fixChangelogHeadings();
}

main();
