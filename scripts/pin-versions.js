#!/usr/bin/env node

/**
 * Pin Dependencies Script
 *
 * Extracts exact versions from yarn.lock and updates all package.json files
 * to use exact versions instead of semver ranges (^ and ~).
 *
 * Preserves:
 * - workspace:^ references (internal packages)
 * - peerDependencies ranges (for consumer compatibility)
 *
 * Usage: node scripts/pin-versions.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const YARN_LOCK_PATH = path.join(ROOT_DIR, 'yarn.lock');

/**
 * Parse yarn.lock (Yarn 4 format) to extract version resolutions
 * Returns a map of "package@range" -> resolved version
 */
function parseYarnLock() {
  const content = fs.readFileSync(YARN_LOCK_PATH, 'utf-8');
  const resolutions = new Map();

  // Yarn 4 lockfile format uses YAML-like structure
  // Example entries:
  // "@backstage/app-defaults@npm:^1.7.0":
  //   version: 1.7.0
  //
  // "react@npm:^18.0.0, react@npm:^18.0.2":
  //   version: 18.3.1

  const lines = content.split('\n');
  let currentSpecs = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match package spec lines
    // Can be quoted or unquoted, single or multiple packages
    if (line.match(/^"?[^"\s]+@npm:[^:]+":?\s*$/) || line.match(/^"[^"]+":?\s*$/)) {
      currentSpecs = [];

      // Extract all package@range patterns from the line
      // Pattern: "package@npm:range" or package@npm:range
      const lineContent = line.replace(/^"|":\s*$/g, '').replace(/:$/, '');
      const specs = lineContent.split(', ');

      for (const spec of specs) {
        const match = spec.match(/^"?(.+)@npm:(.+?)"?$/);
        if (match) {
          currentSpecs.push({ name: match[1], range: match[2] });
        }
      }
    }

    // Match version line - comes after package spec
    if (line.match(/^\s+version:\s/) && currentSpecs.length > 0) {
      const versionMatch = line.match(/version:\s+"?([^"\s]+)"?/);
      if (versionMatch) {
        const version = versionMatch[1];
        for (const spec of currentSpecs) {
          // Store as "name@range" -> version
          const key = `${spec.name}@${spec.range}`;
          resolutions.set(key, version);
        }
      }
      currentSpecs = [];
    }
  }

  return resolutions;
}

/**
 * Get the resolved version for a package with a given range
 */
function getResolvedVersion(resolutions, name, range) {
  const key = `${name}@${range}`;
  return resolutions.get(key);
}

/**
 * Find all package.json files in the monorepo
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
 * Pin versions in a dependencies object
 */
function pinDependencies(deps, resolutions, depType) {
  if (!deps) return { updated: 0, skipped: [] };

  let updated = 0;
  const skipped = [];

  for (const [name, version] of Object.entries(deps)) {
    // Skip workspace references
    if (version.startsWith('workspace:')) {
      continue;
    }

    // Skip link references
    if (version.startsWith('link:')) {
      continue;
    }

    // Skip * or other special versions
    if (version === '*' || version === 'latest') {
      skipped.push(`${name}: special version`);
      continue;
    }

    // Skip already exact versions (no ^ or ~ or >= etc)
    if (/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(version)) {
      continue;
    }

    // Get exact version from lockfile using the original range
    const exactVersion = getResolvedVersion(resolutions, name, version);
    if (exactVersion) {
      deps[name] = exactVersion;
      updated++;
    } else {
      skipped.push(`${name}@${version}: not found in lockfile`);
    }
  }

  return { updated, skipped };
}

/**
 * Main function
 */
function main() {
  console.log('Pin Dependencies to Exact Versions\n');

  // Parse yarn.lock
  console.log('Parsing yarn.lock...');
  const resolutions = parseYarnLock();
  console.log(`Found ${resolutions.size} resolutions in lockfile\n`);

  // Find all package.json files
  const packageFiles = findPackageJsonFiles();
  console.log(`Found ${packageFiles.length} package.json files\n`);

  let totalUpdated = 0;
  const allSkipped = [];

  for (const pkgPath of packageFiles) {
    const relativePath = path.relative(ROOT_DIR, pkgPath);
    console.log(`Processing: ${relativePath}`);

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    let fileUpdated = 0;

    // Pin dependencies
    const depsResult = pinDependencies(pkg.dependencies, resolutions, 'dependencies');
    fileUpdated += depsResult.updated;
    allSkipped.push(...depsResult.skipped);

    // Pin devDependencies
    const devDepsResult = pinDependencies(pkg.devDependencies, resolutions, 'devDependencies');
    fileUpdated += devDepsResult.updated;
    allSkipped.push(...devDepsResult.skipped);

    // Pin resolutions (if present)
    const resolutionsResult = pinDependencies(pkg.resolutions, resolutions, 'resolutions');
    fileUpdated += resolutionsResult.updated;
    allSkipped.push(...resolutionsResult.skipped);

    // Note: Skip peerDependencies to maintain compatibility

    if (fileUpdated > 0) {
      // Write updated package.json with proper formatting
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`   Updated ${fileUpdated} dependencies`);
    } else {
      console.log(`   No changes needed`);
    }

    totalUpdated += fileUpdated;
  }

  console.log('\n' + '='.repeat(50));
  console.log(`\nTotal dependencies pinned: ${totalUpdated}`);

  if (allSkipped.length > 0) {
    console.log(`\nSkipped ${allSkipped.length} dependencies:`);
    // Show unique skipped reasons
    const uniqueSkipped = [...new Set(allSkipped)];
    uniqueSkipped.slice(0, 10).forEach(s => console.log(`   - ${s}`));
    if (uniqueSkipped.length > 10) {
      console.log(`   ... and ${uniqueSkipped.length - 10} more`);
    }
  }

  console.log('\nNext steps:');
  console.log('   1. Run: yarn install');
  console.log('   2. Run: yarn tsc');
  console.log('   3. Commit the changes\n');
}

main();
