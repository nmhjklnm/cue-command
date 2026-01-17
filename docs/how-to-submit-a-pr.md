# How to submit a PR

## 1. Prerequisites

- Make sure you have write access to the repository (or submit a PR from a fork).
- Use Node.js locally (recommended to match `package.json` `engines`).

## 2. Update `main` and create a branch

- Pull the latest `main`.
- Create a new branch (recommended naming):
  - `feature/<short-desc>`
  - `fix/<short-desc>`
  - `chore/<short-desc>`

## 3. Development and local checks

- Make your changes.
- Run minimal local checks:
  - `npm ci`
  - `npm run prepare`
  - Optional: run a quick manual validation relevant to your change.

## 4. Commit conventions

- Recommended commit message prefixes:
  - `feat: ...`
  - `fix: ...`
  - `refactor: ...`
  - `chore: ...`

- Keep the PR focused: ideally one PR addresses one category of change.

## 5. Push your branch and create a PR (recommended: gh)

- Push your branch:
  - `git push -u origin <your-branch>`

- Create the PR:
  - `gh pr create -R nmhjklnm/cue-command`

- Suggested PR description:
  - Why (motivation)
  - What (changes)
  - How to test
  - Risks / impact

## 6. CI and review

- Ensure all PR checks pass (CI runs on PRs).
- Address review feedback by pushing additional commits.

## 7. Merge policy

- This repository uses a ruleset: only `squash` / `rebase` merges are allowed.
- Generally, **squash merge** is recommended to keep `main` history clean.

## 8. Post-merge

- After merging, confirm `main` CI runs and succeeds.
- If a release is required, follow the repository release process.

## 9. Common pitfalls

- **CI did not run**
  - Confirm your PR targets `main`, and check workflow triggers (`pull_request` / `push` branch filters).
  - Use `gh pr checks <PR_NUMBER> -R nmhjklnm/cue-command` to see if checks are present.

- **CI fails (works locally but fails in CI)**
  - Prefer `npm ci` (depends on the lockfile) and keep `package-lock.json` in sync with `package.json`.
  - Use `gh run view <RUN_ID> -R nmhjklnm/cue-command` to inspect the failing step.

- **Merge button disabled / merge method rejected**
  - The ruleset allows only `squash` / `rebase`; merge commits are not allowed.
  - Selecting a disallowed merge method in the UI will be blocked by the rules.

- **Conflicts / need to sync with `main`**
  - Update your branch with the latest `main` (rebase or merge per team preference).
  - After resolving conflicts, push again and CI will rerun.

- **Useful gh commands**
  - View PR: `gh pr view <PR_NUMBER> -R nmhjklnm/cue-command`
  - View diff: `gh pr diff <PR_NUMBER> -R nmhjklnm/cue-command`
  - View checks: `gh pr checks <PR_NUMBER> -R nmhjklnm/cue-command`
  - List main runs: `gh run list -R nmhjklnm/cue-command --branch main`
