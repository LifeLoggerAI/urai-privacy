# URAI-PRIVACY Services

This document outlines the core services that make up the URAI-PRIVACY platform.

## 1. Web Application (Next.js)

*   **Description:** The primary user interface for the URAI-PRIVACY platform. It is a Next.js application that provides all of the user-facing features, including the admin dashboard, audit log viewer, and privacy request forms.
*   **Location:** `/app`

## 2. Firebase Functions

*   **Description:** The backend logic for the URAI-PRIVACY platform. These are serverless functions that provide API endpoints for submitting security reports and privacy requests, as well as an event trigger for assessing the risk of new security reports.
*   **Location:** `/functions`
