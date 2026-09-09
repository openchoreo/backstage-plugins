#!/bin/bash

# Configure npm trusted publishing (OIDC) for every published @openchoreo/*
# package.
#
# npm binds a trusted publisher to an exact (repository, workflow file,
# environment) triple, per package — there is no scope-wide configuration. This
# script applies the same triple to all of them so the set cannot drift.
#
# Re-run this after:
#   - adding a new published package (it needs its own trusted publisher)
#   - renaming .github/workflows/release.yml or the deployment environment
#   - transferring npm org ownership, to confirm the configs survived
#
# Prerequisites
#   - npm >= 11.15.0                (`npm install -g npm@latest`)
#   - an interactive npm session    (`npm login`; publish rights on @openchoreo)
#   - 2FA enabled on the npm account — `npm trust` rejects granular tokens
#     using the bypass-2FA setting
#   - each package must ALREADY EXIST on the registry; npm cannot configure a
#     trusted publisher for a name it has never seen. For a brand-new package,
#     publish the first version by another route first.
#
# Usage
#   scripts/configure-npm-trusted-publishers.sh            # show planned changes
#   scripts/configure-npm-trusted-publishers.sh --execute
#   scripts/configure-npm-trusted-publishers.sh --list     # audit current state

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# These three values are the OIDC claim npm matches against. They MUST stay in
# sync with .github/workflows/release.yml — a mismatch surfaces as a misleading
# 404 on publish, not an auth error, and npm does not validate the config when
# it is saved.
REPOSITORY="openchoreo/backstage-plugins"
WORKFLOW_FILE="release.yml"   # bare filename, not a path
ENVIRONMENT="npm-publish"

MODE="dry-run"
case "${1:-}" in
    --execute) MODE="execute" ;;
    --list) MODE="list" ;;
    "") ;;
    *)
        echo "Usage: $0 [--execute|--list]" >&2
        exit 1
        ;;
esac

# The published set is the `linked` group in the changeset config — the same
# list that bumps in lockstep on every release.
mapfile -t PACKAGES < <(
    node -e '
        const config = require("'"${ROOT_DIR}"'/.changeset/config.json");
        for (const name of (config.linked || []).flat()) console.log(name);
    '
)

if [ "${#PACKAGES[@]}" -eq 0 ]; then
    echo "ERROR: no published packages found in .changeset/config.json" >&2
    exit 1
fi

echo "${#PACKAGES[@]} published package(s)"
echo "  repository:  ${REPOSITORY}"
echo "  workflow:    ${WORKFLOW_FILE}"
echo "  environment: ${ENVIRONMENT}"
echo ""

failed=()
for pkg in "${PACKAGES[@]}"; do
    case "${MODE}" in
        list)
            echo "== ${pkg}"
            npm trust list "${pkg}" || failed+=("${pkg}")
            ;;
        dry-run)
            echo "would configure ${pkg}"
            ;;
        execute)
            echo "== ${pkg}"
            if npm trust github "${pkg}" \
                --repository "${REPOSITORY}" \
                --file "${WORKFLOW_FILE}" \
                --environment "${ENVIRONMENT}" \
                --allow-publish \
                --yes; then
                echo "   configured"
            else
                echo "   FAILED"
                failed+=("${pkg}")
            fi
            ;;
    esac
done

if [ "${#failed[@]}" -gt 0 ]; then
    echo ""
    echo "FAILED for ${#failed[@]} package(s):"
    printf '  %s\n' "${failed[@]}"
    exit 1
fi

if [ "${MODE}" = "dry-run" ]; then
    echo ""
    echo "Dry run only. Re-run with --execute to apply, or --list to audit."
fi
