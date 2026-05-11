
# URAI-PRIVACY Smoke Test

This document outlines the steps to manually smoke test the URAI-PRIVACY application.

## Local Development

1.  **Start the development server:**

    ```bash
    npm run dev
    ```

2.  **Open the application in your browser:** [http://localhost:3000](http://localhost:3000)

## Emulator

1.  **Start the Firebase emulators:**

    ```bash
    firebase emulators:start
    ```

2.  **Open the Emulator UI in your browser:** [http://localhost:4000](http://localhost:4000)

## Production Build

1.  **Build the application:**

    ```bash
    npm run build
    ```

2.  **Start the production server:**

    ```bash
    npm run start
    ```

## Firebase Deploy

1.  **Deploy to Firebase:**

    ```bash
    firebase deploy --only hosting,functions,firestore,storage
    ```

## Live URL Verification

1.  **Open the deployed application in your browser.**

## Auth

1.  **Verify that unauthenticated users are redirected from the privacy dashboard.**
2.  **Verify that authenticated users can access the privacy dashboard.**

## Consent Update

1.  **Navigate to the privacy dashboard.**
2.  **Toggle a consent setting and verify that it is saved.**

## Export Request

1.  **Navigate to the privacy dashboard.**
2.  **Request a data export and verify that the request is successful.**

## Deletion Request

1.  **Navigate to the privacy dashboard.**
2.  **Request data deletion and verify that the request is successful.**

## Audit Log Verification

1.  **Navigate to the privacy dashboard.**
2.  **Verify that the audit log is displayed and contains the recent actions.**

## Firestore Verification

1.  **Open the Firestore emulator UI.**
2.  **Verify that the consent, export, and deletion data is correctly stored in Firestore.**

## Mobile Verification

1.  **Open the application in a mobile browser or using browser developer tools.**
2.  **Verify that the application is responsive and usable on a mobile device.**
