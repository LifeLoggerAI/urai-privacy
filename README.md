
# URAI-PRIVACY Deployment Guide

This guide provides instructions for deploying the URAI-PRIVACY application to Firebase.

## Prerequisites

- Firebase CLI installed and authenticated (`firebase login`)
- Access to the URAI Firebase project

## Deployment Steps

1. **Deploy Firebase Resources:**

   ```bash
   firebase deploy --only hosting,functions,firestore,storage
   ```

   This single command deploys all necessary Firebase resources, including Hosting, Cloud Functions, and Firestore rules.

## Environment Variables

Create a `.env.local` file in the root of the project with the following environment variables:

```
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="..."
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
NEXT_PUBLIC_FIREBASE_APP_ID="..."
```

These variables are essential for connecting the Next.js frontend to your Firebase project.

## New Features

- **Live Data Usage Ledger:** The data usage ledger now displays real-time data from Firestore, providing an auditable trail of data lineage. This feature is powered by the new `getLineage` Cloud Function, which retrieves data lineage records for the authenticated user.

- **Simplified Deployment:** The deployment process has been streamlined. You can now deploy all necessary Firebase resources with a single command.

## Domain Configuration

The application will be accessible at `privacy.urai.app`. Configure the custom domain in the Firebase Hosting console.
