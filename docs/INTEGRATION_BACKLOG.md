# URAI Privacy Integration Backlog

Status: execution backlog.

## Critical path

1. Verify DNS and HTTPS for uraiprivacy.com and www.uraiprivacy.com.
2. Publish the static website from the website directory.
3. Add a user request intake flow for export, deletion, consent revocation, and support.
4. Implement account-linked consent storage.
5. Implement export and deletion workflows across production data stores.
6. Add privacy adoption files to each production URAI repository.
7. Add CI checks that block releases when privacy adoption files are missing or invalid.
8. Build an internal admin queue for processing user requests.
9. Add audit events for consent changes, exports, deletions, admin access, and policy changes.
10. Complete review and approval of public policy notices before final launch.

## Product adoption template package

Use `templates/product-privacy/` as the starting package for every URAI production repository.

Required destination layout in product repos:

```text
privacy/PRIVACY_VERSION.md
privacy/data-inventory.yaml
privacy/feature-manifests/<feature-id>.yaml
privacy/adoption-report.md
```

Template source files:

```text
templates/product-privacy/PRIVACY_VERSION.md
templates/product-privacy/data-inventory.yaml
templates/product-privacy/feature-manifest.yaml
templates/product-privacy/ADOPTION_CHECKLIST.md
```

## Definition of done

URAI Privacy is complete only when the public site is live, users can exercise rights end to end, production repos pass privacy checks, admin workflows are audited, and release gates prevent non-compliant data features from shipping.
