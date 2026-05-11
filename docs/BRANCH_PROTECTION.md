# Branch Protection Standard

This repository is a governance package. Changes to policy, legal templates, schemas, validation tooling, and public website content should go through review and automated validation.

## Required Protection for `main`

Enable branch protection for `main` with these settings:

- Require a pull request before merging.
- Require at least one approving review.
- Dismiss stale approvals when new commits are pushed.
- Require review from Code Owners where available.
- Require status checks to pass before merging.
- Require branches to be up to date before merging where available.
- Block force pushes.
- Block branch deletion.
- Require conversation resolution before merging.

## Required Status Checks

Require these checks for merges into `main`:

- `Privacy package validation / validate`
- `Website validation / validate`
- `CodeQL analysis / Analyze Python`

If GitHub exposes slightly different check names, select the corresponding checks that run:

- `python tools/run_validation.py`
- `python tools/check_website.py`
- CodeQL Python analysis

## Recommended Repository Security Settings

Enable these repository security features where the GitHub plan supports them:

- Secret scanning.
- Push protection for secrets.
- Dependabot alerts.
- Dependabot security updates.
- Code scanning alerts.
- Private vulnerability reporting, if available.

## Exception Handling

Exceptions should be rare and documented. If an administrator merges an urgent change outside the normal review path, create or update an issue with:

1. Why the exception was required.
2. Which files changed.
3. Which validation commands were run locally.
4. Who approved the exception.
5. What follow-up PR or issue restores normal governance.

## Local Validation Before Merge

Run the same validation entrypoint used by CI:

```bash
python tools/run_validation.py
```

## Owner Checklist

- [ ] `main` branch protection is enabled.
- [ ] Required PR reviews are enabled.
- [ ] CODEOWNERS review is enabled, if available.
- [ ] Required status checks include privacy package validation.
- [ ] Required status checks include website validation.
- [ ] Required status checks include CodeQL analysis.
- [ ] Force pushes are blocked.
- [ ] Branch deletion is blocked.
- [ ] Secret scanning and push protection are enabled, if available.
- [ ] Dependabot alerts and security updates are enabled.
