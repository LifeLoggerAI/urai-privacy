# URAI Privacy Website

Public website for the URAI Privacy governance package.

Canonical domain: `uraiprivacy.com`

## Purpose

The website explains URAI Privacy in plain language and links to the public governance repository, governance index, user-rights concepts, legal notice templates, request intake, and support/contact routing.

## Pages

- `index.html` - homepage
- `principles.html` - privacy principles
- `rights.html` - user rights overview
- `governance.html` - governance and enforcement model
- `legal.html` - public legal notice template index
- `request.html` - public privacy request intake placeholder and launch specification
- `contact.html` - privacy, security, support, and GitHub contact routes
- `status.html` - launch status and blockers
- `404.html` - not found page

## Static Files

- `styles.css` - shared visual styling
- `robots.txt` - crawler guidance
- `sitemap.xml` - public page index
- `CNAME` - custom domain support
- `.nojekyll` - GitHub Pages static publishing marker
- `PUBLISHING.md` - deployment and DNS notes

## GitHub Pages Notes

- Root-level `CNAME` is included for GitHub Pages custom-domain support when serving from the repository root.
- `website/CNAME` is also included for workflows that publish the `website/` directory.
- DNS for `uraiprivacy.com` must point to the selected hosting target before the domain resolves.
- Enable HTTPS once DNS resolves.

## Production Status

This site is an operational governance landing page. The request page is an intake placeholder until authenticated submission, request IDs, status tracking, internal queue routing, and audit logging are implemented. Public legal templates still require qualified legal review before production launch.
