#!/bin/bash
# URAI SHIPMASTER: Post-Deployment Cleanup Script

set -euo pipefail

echo "--- INITIATING POST-DEPLOYMENT CLEANUP ---"

# Find and delete all backup files created by the shipping script
echo "Searching for and removing backup files (.bak.*)..."
# The find command will print the name of each file found and then delete it.
# Using -print to make it clear which files are being removed.
find . -type f -name "*.bak.*" -print -delete
echo "✅ Backup files removed."

# Self-destruct: Remove the main shipping script
if [ -f "urai_ship_urai_privacy.sh" ]; then
    echo "Removing urai_ship_urai_privacy.sh..."
    rm "urai_ship_urai_privacy.sh"
    echo "✅ Shipping script removed."
fi

# Finally, remove this cleanup script itself.
# The script will be deleted after its execution is complete.
echo "Removing cleanup script..."
rm -- "$0"

echo "--- MISSION COMPLETE. REPOSITORY CLEAN. ---"
