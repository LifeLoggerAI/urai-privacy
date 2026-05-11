# urai-privacy Architecture

This document provides an overview of the project's architecture, including the Firestore schema, cloud functions, and threat model.

## Firestore Schema

-   **privacyUsers/{uid}**: Stores user-specific data, including roles.
-   **userConsents/{uid}**: Stores user consent information.
-   **dataRights/{requestId}**: Stores Data Subject Access Requests (for data export or deletion).
-   **dataExports/{exportId}**: Stores the results of data export requests.
-   **auditLogs/{logId}**: Stores audit logs for all actions.
-   **policyDocs/{docId}**: Stores privacy policy documents.
-   **consentTiers/{tierId}**: Stores different tiers of consent.
-   **transparency/{entryId}**: Stores transparency log entries.
-   **system/{docId}**: Stores system-wide configuration.


## Cloud Functions

-   **processDataRequest**: A Firestore-triggered function that handles data export and deletion requests upon creation of a document in the `dataRights` collection.
-   **health**: An HTTPS-triggered function to check the health of the service.

## Threat Model

-   **Unauthorized Access**: Firestore and Storage rules are in place to prevent unauthorized access to data.
-   **Data Integrity**: All data is validated before being written to the database.
-   **Denial of Service**: The cloud functions are designed to be scalable and resilient to denial of service attacks.
