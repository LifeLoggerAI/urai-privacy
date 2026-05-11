# urai-privacy Lockdown

This document outlines the steps to run, deploy, and maintain the urai-privacy project.

## Local Development

1.  **Install Dependencies:** `pnpm install`
2.  **Run Development Server:** `pnpm dev`

## Deployment

1.  **Build Project:** `pnpm build`
2.  **Deploy to Firebase:** `firebase deploy --only hosting,functions,firestore,storage`

## Admin Roles

To grant a user admin privileges, set the `roles.admin` custom claim on their Firebase Auth user to `true`.

## DSAR Email Wiring

The DSAR flow is designed to send a verification email. To enable this, you will need to configure a mail transport service (e.g., Nodemailer with SendGrid) in the `createDsarRequest` cloud function.

## Key Rotation

It is recommended to periodically rotate the service account keys used by the project.
