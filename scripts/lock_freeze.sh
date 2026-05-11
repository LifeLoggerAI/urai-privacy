#!/bin/bash
# URAI Privacy Lock & Freeze Script
#
# This script automates the deployment of the URAI Privacy website to Firebase.
# It performs the following steps:
# 1. Checks for prerequisites (git status, pnpm, firebase-cli).
# 2. Runs quality checks (lint, typecheck, tests).
# 3. Builds the project.
# 4. Deploys the project to Firebase.
# 5. Creates a git tag for the deployment.
#
# Usage: ./scripts/lock_freeze.sh [OPTIONS]
#
# Options:
#   --dry-run      Run all checks and build steps without deploying or tagging.
#   -y, --yes      Bypass the interactive deployment confirmation.
#   -h, --help     Display this help message and exit.
#
# Example:
#   ./scripts/lock_freeze.sh --dry-run

set -euo pipefail

# --- COLORS ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

LOG_FILE="/tmp/urai_privacy_lock_freeze_$(date +%Y%m%d_%H%M%S).log"
DRY_RUN=false
FORCE_YES=false

exec > >(tee -a "${LOG_FILE}") 2>&1

function check_prerequisites() {
  echo -e "\n${YELLOW}[STEP 1] Checking prerequisites...${NC}"

  if [[ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]]; then
    echo -e "${RED}ERROR: Not on the main branch. Please switch to the main branch before deploying.${NC}"
    exit 1
  fi
  echo -e "${GREEN}SUCCESS: On main branch.${NC}"

  git fetch origin
  if [[ $(git rev-parse HEAD) != $(git rev-parse origin/main) ]]; then
    echo -e "${RED}ERROR: Local main branch is not up-to-date with origin/main. Please pull the latest changes.${NC}"
    exit 1
  fi
  echo -e "${GREEN}SUCCESS: Main branch is up-to-date.${NC}"

  if ! git diff --quiet; then
    echo -e "${RED}ERROR: Git working directory is not clean. Please commit or stash your changes.${NC}"
    exit 1
  fi
  echo -e "${GREEN}SUCCESS: Git directory is clean.${NC}"

  if ! command -v npm &> /dev/null; then
      echo -e "${RED}ERROR: npm run is not installed. Please install npm run to continue.${NC}"
      exit 1
  fi
  echo -e "${GREEN}SUCCESS: npm run is installed.${NC}"

  if ! command -v firebase &> /dev/null; then
      echo -e "${RED}ERROR: Firebase CLI is not installed. Please install it with 'npm install -g firebase-tools' to continue.${NC}"
      exit 1
  fi
  echo -e "${GREEN}SUCCESS: Firebase CLI is installed.${NC}"

  if ! firebase projects:list >/dev/null 2>&1; then
      echo -e "${RED}ERROR: Not logged into Firebase. Please run 'firebase login' to continue.${NC}"
      exit 1
  fi
  echo -e "${GREEN}SUCCESS: Logged into Firebase.${NC}"
}

function run_quality_checks() {
  echo -e "\n${YELLOW}[STEP 2] Running quality checks...${NC}"

  echo -e "${YELLOW}Installing dependencies...${NC}"
  if ! npm install; then
    echo -e "${RED}ERROR: npm install failed. See log for details.${NC}"
    exit 1
  fi
  echo -e "${GREEN}SUCCESS: Dependencies installed.${NC}"

  echo -e "\n${YELLOW}Running lint checks...${NC}"
  if ! npm run lint; then
    echo -e "${RED}ERROR: Lint checks failed. See log for details.${NC}"
    exit 1
  fi
  echo -e "${GREEN}SUCCESS: Lint checks passed.${NC}"

  echo -e "\n${YELLOW}Running type checks...${NC}"
  if ! npm run typecheck; then
    echo -e "${RED}ERROR: Type checks failed. See log for details.${NC}"
    exit 1
  fi
  echo -e "${GREEN}SUCCESS: Type checks passed.${NC}"

  echo -e "\n${YELLOW}Running Playwright tests...${NC}"
  if ! npm run test; then
    echo -e "${RED}ERROR: Playwright tests failed. See log for details.${NC}"
    exit 1
  fi
  echo -e "${GREEN}SUCCESS: Playwright tests passed.${NC}"
}

function build_project() {
  echo -e "\n${YELLOW}[STEP 3] Building the project...${NC}"
  if ! npm run build; then
    echo -e "${RED}ERROR: Project build failed. See log for details.${NC}"
    exit 1
  fi
  echo -e "${GREEN}SUCCESS: Project built.${NC}"
}

function deploy_and_tag() {
    echo -e "\n${YELLOW}[STEP 4] Deploying and tagging...${NC}"

    if [ "$FORCE_YES" = false ]; then
      echo -e "\n${YELLOW}Confirming deployment...${NC}"
      read -p "Do you want to proceed with deployment? [y/N] " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
          echo -e "${RED}Deployment aborted.${NC}"
          exit 1
      fi
    fi

    echo -e "\n${YELLOW}Deploying to Firebase...${NC}"
    if ! firebase deploy; then
      echo -e "${RED}ERROR: Firebase deploy failed. See log for details.${NC}"
      exit 1
    fi
    echo -e "${GREEN}SUCCESS: Deployed to Firebase.${NC}"

    echo -e "\n${YELLOW}Tagging release...${NC}"
    TAG_NAME="deploy-$(date +%Y%m%d-%H%M%S)"
    if ! git tag "${TAG_NAME}"; then
      echo -e "${RED}ERROR: Failed to create git tag. See log for details.${NC}"
      exit 1
    fi
    if ! git push origin "${TAG_NAME}"; then
      echo -e "${RED}ERROR: Failed to push git tag. See log for details.${NC}"
      exit 1
    fi
    echo -e "${GREEN}SUCCESS: Tagged release as ${TAG_NAME} and pushed to origin.${NC}"
}

function main() {
  while [[ "$#" -gt 0 ]]; do
    case $1 in
      -h|--help)
        sed -n '2,/^$/p' "$0"
        exit 0
        ;;
      -y|--yes)
        FORCE_YES=true
        shift
        ;;
      --dry-run)
        DRY_RUN=true
        shift
        ;;
      *)
        echo -e "${RED}Unknown option: $1${NC}"
        sed -n '2,/^$/p' "$0"
        exit 1
        ;;
    esac
  done

  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}--- STARTING URAI PRIVACY LOCK & FREEZE SCRIPT (DRY RUN) ---${NC}"
  else
    echo -e "${YELLOW}--- STARTING URAI PRIVACY LOCK & FREEZE SCRIPT ---${NC}"
  fi
  
  check_prerequisites
  run_quality_checks
  build_project

  if [ "$DRY_RUN" = true ]; then
    echo -e "\n${GREEN}--- DRY RUN COMPLETED SUCCESSFULLY ---${NC}"
    echo "Log file: ${LOG_FILE}"
    exit 0
  fi

  deploy_and_tag

  echo -e "\n${GREEN}--- URAI PRIVACY LOCK & FREEZE SCRIPT COMPLETED SUCCESSFULLY ---${NC}"
  echo "Log file: ${LOG_FILE}"
}

main "$@"
