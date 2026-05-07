# URAI Privacy Website Publishing Guide

Canonical domain: `uraiprivacy.com`

## Website Contents

The public site lives in `website/` and includes:

- `index.html` - homepage
- `principles.html` - privacy principles
- `rights.html` - user rights overview
- `governance.html` - governance/enforcement model
- `legal.html` - legal notice template index
- `contact.html` - privacy/security/support contact routing
- `404.html` - not found page
- `styles.css` - shared styling
- `robots.txt` - crawler guidance
- `sitemap.xml` - public page list
- `CNAME` - custom domain support
- `.nojekyll` - GitHub Pages static publishing marker

## GitHub Pages Setup

Recommended settings:

1. Source: deploy from branch.
2. Branch: `main`.
3. Folder: `/website` if GitHub Pages is configured to serve from the `website/` directory.
4. Custom domain: `uraiprivacy.com`.
5. Enforce HTTPS after DNS resolves.

The repo also includes a root `CNAME` for workflows that publish from repository root.

## DNS Notes

Point `uraiprivacy.com` to the chosen host. For GitHub Pages, configure DNS according to GitHub Pages custom domain guidance and verify the domain in repository settings.

## Pre-Publish Checklist

- [ ] DNS points to the selected host.
- [ ] HTTPS is enabled.
- [ ] `https://uraiprivacy.com/` loads.
- [ ] `https://uraiprivacy.com/sitemap.xml` loads.
- [ ] `https://uraiprivacy.com/robots.txt` loads.
- [ ] All nav links work.
- [ ] Legal draft status is visible.
- [ ] Contact routes are correct.
- [ ] `python tools/validate_privacy_package.py` passes.

## Legal Status

The website is an operational governance landing site. Legal templates and regulatory mappings require qualified legal review before public production launch.
