#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 OpenAPI Client Generator${NC}"
echo ""

# Display usage
usage() {
  cat << EOF
Usage: $0 --config <config-file>

Options:
  --config FILE   Path to JSON configuration file (required)
  --help         Display this help message

Configuration file format (JSON):
{
  "outputDir": "src/generated",
  "specs": [
    {
      "name": "user",
      "input": "openapi/user.yaml",
      "description": "User Management API"
    },
    {
      "name": "group",
      "input": "openapi/group.yaml",
      "description": "Group Management API"
    }
  ],
  "versionField": "apiVersion",
  "versionFile": "src/version.ts"
}

Example:
  $0 --config openapi-config.json
EOF
  exit 1
}

# Parse command line arguments
CONFIG_FILE=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --config)
      CONFIG_FILE="$2"
      shift 2
      ;;
    --help)
      usage
      ;;
    *)
      echo -e "${RED}❌ Unknown argument: $1${NC}"
      usage
      ;;
  esac
done

# Validate config file
if [ -z "$CONFIG_FILE" ]; then
  echo -e "${RED}❌ Configuration file is required${NC}"
  usage
fi

if [ ! -f "$CONFIG_FILE" ]; then
  echo -e "${RED}❌ Configuration file not found: ${CONFIG_FILE}${NC}"
  exit 1
fi

# Check if node and jq are available
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js is required but not found${NC}"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo -e "${YELLOW}⚠️  jq not found, using node for JSON parsing${NC}"
  USE_NODE_JSON=true
else
  USE_NODE_JSON=false
fi

# Parse configuration
echo -e "${YELLOW}📋 Reading configuration from ${CONFIG_FILE}...${NC}"

if [ "$USE_NODE_JSON" = true ]; then
  OUTPUT_DIR=$(node -pe "JSON.parse(require('fs').readFileSync('$CONFIG_FILE', 'utf8')).outputDir")
  VERSION_FIELD=$(node -pe "JSON.parse(require('fs').readFileSync('$CONFIG_FILE', 'utf8')).versionField || ''")
  VERSION_FILE=$(node -pe "JSON.parse(require('fs').readFileSync('$CONFIG_FILE', 'utf8')).versionFile || ''")
  SPECS_JSON=$(node -pe "JSON.stringify(JSON.parse(require('fs').readFileSync('$CONFIG_FILE', 'utf8')).specs)")
else
  OUTPUT_DIR=$(jq -r '.outputDir' "$CONFIG_FILE")
  VERSION_FIELD=$(jq -r '.versionField // ""' "$CONFIG_FILE")
  VERSION_FILE=$(jq -r '.versionFile // ""' "$CONFIG_FILE")
  SPECS_JSON=$(jq -c '.specs' "$CONFIG_FILE")
fi

echo -e "${GREEN}✓ Configuration loaded${NC}"
echo -e "   Output directory: ${OUTPUT_DIR}"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Generate version file if versionField is specified
if [ -n "$VERSION_FIELD" ] && [ -n "$VERSION_FILE" ]; then
  echo ""
  echo -e "${YELLOW}📝 Generating version file...${NC}"

  # Get the directory containing the config file
  CONFIG_DIR="$(dirname "$CONFIG_FILE")"
  PACKAGE_JSON="$CONFIG_DIR/package.json"

  if [ -f "$PACKAGE_JSON" ]; then
    VERSION=$(node -pe "require('$PACKAGE_JSON')['$VERSION_FIELD'] || ''")

    if [ -n "$VERSION" ]; then
      cat > "$VERSION_FILE" << EOF
/**
 * API Version
 * Auto-generated from package.json ${VERSION_FIELD} field
 * DO NOT EDIT MANUALLY
 *
 * @packageDocumentation
 */

export const API_VERSION = '${VERSION}';
EOF
      echo -e "${GREEN}✓ Generated ${VERSION_FILE} with version: ${VERSION}${NC}"
    else
      echo -e "${YELLOW}⚠️  ${VERSION_FIELD} not found in package.json, skipping version file${NC}"
    fi
  else
    echo -e "${YELLOW}⚠️  package.json not found, skipping version file${NC}"
  fi
fi

# Process each spec
echo ""
echo -e "${YELLOW}🔨 Generating TypeScript types from OpenAPI specs...${NC}"

if [ "$USE_NODE_JSON" = true ]; then
  SPECS_COUNT=$(node -pe "JSON.parse('$SPECS_JSON').length")
else
  SPECS_COUNT=$(echo "$SPECS_JSON" | jq '. | length')
fi

for ((i=0; i<$SPECS_COUNT; i++)); do
  if [ "$USE_NODE_JSON" = true ]; then
    SPEC_NAME=$(node -pe "JSON.parse('$SPECS_JSON')[$i].name")
    SPEC_INPUT=$(node -pe "JSON.parse('$SPECS_JSON')[$i].input")
    SPEC_DESC=$(node -pe "JSON.parse('$SPECS_JSON')[$i].description || ''")
  else
    SPEC_NAME=$(echo "$SPECS_JSON" | jq -r ".[$i].name")
    SPEC_INPUT=$(echo "$SPECS_JSON" | jq -r ".[$i].input")
    SPEC_DESC=$(echo "$SPECS_JSON" | jq -r ".[$i].description // \"\"")
  fi

  echo ""
  echo -e "${BLUE}Processing: ${SPEC_NAME}${NC}"
  if [ -n "$SPEC_DESC" ]; then
    echo -e "   Description: ${SPEC_DESC}"
  fi
  echo -e "   Input:  ${SPEC_INPUT}"

  # Check if input file exists
  if [ ! -f "$SPEC_INPUT" ]; then
    echo -e "${RED}❌ OpenAPI spec not found: ${SPEC_INPUT}${NC}"
    exit 1
  fi

  # Create output directory for this spec
  SPEC_OUTPUT_DIR="${OUTPUT_DIR}/${SPEC_NAME}"
  mkdir -p "$SPEC_OUTPUT_DIR"

  # Generate TypeScript types
  echo -e "   Generating types..."
  npx openapi-typescript@7.4.4 "$SPEC_INPUT" -o "$SPEC_OUTPUT_DIR/types.ts"

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Types generated successfully${NC}"

    # Format with Prettier
    echo -e "   Formatting with Prettier..."
    npx prettier@2.3.2 --write "$SPEC_OUTPUT_DIR/types.ts" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}✓ Types formatted with Prettier${NC}"
    else
      echo -e "${YELLOW}⚠️  Prettier formatting failed, continuing anyway${NC}"
    fi
  else
    echo -e "${RED}❌ Failed to generate types for ${SPEC_NAME}${NC}"
    exit 1
  fi

  # Create index file
  cat > "$SPEC_OUTPUT_DIR/index.ts" << EOF
/**
 * ${SPEC_DESC:-${SPEC_NAME} API Client}
 * Auto-generated TypeScript types from OpenAPI spec
 *
 * @packageDocumentation
 */

export * from './types';
EOF

  echo -e "${GREEN}✓ Index file created${NC}"
done

# Summary
echo ""
echo -e "${GREEN}✅ API client generation completed successfully!${NC}"
echo ""
echo -e "${BLUE}📦 Generated clients:${NC}"
for ((i=0; i<$SPECS_COUNT; i++)); do
  if [ "$USE_NODE_JSON" = true ]; then
    SPEC_NAME=$(node -pe "JSON.parse('$SPECS_JSON')[$i].name")
  else
    SPEC_NAME=$(echo "$SPECS_JSON" | jq -r ".[$i].name")
  fi
  echo -e "   ${SPEC_NAME}: ${OUTPUT_DIR}/${SPEC_NAME}"
done
echo ""
echo -e "${BLUE}💡 Next steps:${NC}"
echo -e "   1. Review generated clients in ${OUTPUT_DIR}/"
echo -e "   2. Create factory functions to instantiate clients"
echo -e "   3. Run 'yarn build' to compile the package"
echo -e "   4. Import and use the clients in your code"
echo ""
