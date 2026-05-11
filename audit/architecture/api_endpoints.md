# URAI-PRIVACY API Endpoints

This document outlines the API endpoints for the URAI-PRIVACY platform.

## Callable Functions

These are the primary API endpoints for the platform, implemented as Firebase Callable Functions.

### 1. `submitSecurityReport`

*   **Description:** Allows users to submit a security report.
*   **Location:** `/functions/src/index.ts`
*   **Authentication:** Publicly accessible.

### 2. `submitPrivacyRequest`

*   **Description:** Allows users to submit a privacy request (e.g., data deletion, data export).
*   **Location:** `/functions/src/index.ts`
*   **Authentication:** Publicly accessible.

### 3. `logTransparencyUpdate`

*   **Description:** Allows an administrator to log a transparency update.
*   **Location:** `/functions/src/index.ts`
*   **Authentication:** Requires administrator privileges.
