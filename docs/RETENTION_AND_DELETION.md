# Retention and Deletion Standard

URAI data must have a retention class before storage.

## Retention Classes

| Class | Name | Default Duration | Examples |
|---|---|---:|---|
| R0 | Ephemeral | seconds to 24 hours | transient raw audio buffers, temporary processing files |
| R1 | Session / operational | 30 days | service logs, retry queues, temporary analytics |
| R2 | User memory | until user deletes or account closes | user-approved memories, timeline records |
| R3 | Derived insight | 12 months unless renewed by user activity | mood summaries, relationship trend summaries |
| R4 | Consent and audit evidence | 7 years or legal minimum | consent events, privacy request logs |
| R5 | De-identified aggregate | indefinite if re-identification risk remains controlled | cohort analytics, anonymized data products |
| R6 | Restricted biometric | shortest feasible period; default 90 days unless user renews | voiceprints, face embeddings |

## Deletion Requirements

Deletion must be available at four levels:

1. Individual record deletion
2. Category deletion
3. Time-range deletion
4. Account deletion

## Deletion Job Stages

1. `requested`
2. `validated`
3. `queued`
4. `primary_store_deleted`
5. `derived_records_deleted_or_recomputed`
6. `backup_expiry_scheduled`
7. `completed`
8. `failed_with_reason`

## Derived Data Rule

When raw source data is deleted, dependent derived insights must either be deleted or recomputed without the deleted source. A derived insight must not preserve sensitive meaning that the user intended to erase.

## Backup Rule

Backups may expire on a delayed schedule, but deleted user data must not be restored into active systems. Backup retention timelines must be disclosed.

## Biometric Deletion Rule

Biometric templates, voiceprints, face embeddings, and identity vectors must be deletable independently from the rest of the account.

## Legal Hold Exception

Legal holds must be rare, documented, scoped, time-bound, and visible to authorized privacy administrators only. The user should receive notice unless prohibited by law.
