# URAI Foundation Integration

URAI Privacy uses URAI Foundation as the public-interest governance, transparency, consent, and accountability anchor for privacy-sensitive systems.

## Canonical references

- Foundation repository: `LifeLoggerAI/urai-foundation`
- Public domain target: `https://uraifoundation.org/`
- Governance charter: `https://uraifoundation.org/docs/governance-charter.md`
- Ethical AI principles: `https://uraifoundation.org/docs/ethical-ai-principles.md`
- Transparency framework: `https://uraifoundation.org/docs/transparency-framework.md`
- Risk review process: `https://uraifoundation.org/docs/risk-review-process.md`
- System-of-systems contract: `https://uraifoundation.org/docs/system-of-systems-integration.md`

## Privacy alignment requirements

Privacy changes should reference Foundation standards when they affect:

- consent basis or consent-tier behavior;
- retention, deletion, redaction, or anonymization commitments;
- data-sharing boundaries;
- audit logs or transparency reporting;
- high-risk user data, sensitive context, or user-control surfaces;
- public privacy claims or partner-facing governance posture.

## Release gate

Before production release, URAI Privacy should verify:

```bash
python3 tools/validate_privacy_package.py
```

If the change affects Foundation commitments, also verify the Foundation repository:

```bash
git pull origin main
python3 -m unittest discover -s tests
python3 scripts/validate-docs.py
```

## Live-domain caveat

Do not treat `uraifoundation.org` as live on GitHub Pages until DNS no longer resolves to Squarespace and `/sitemap.xml` returns `200`.
