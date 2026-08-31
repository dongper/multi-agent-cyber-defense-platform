---
name: sync-local-folder-to-repo
description: "Use when pushing a non-git local folder to an existing repo."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [GitHub, Git, rsync, Sync, Repositories]
    related_skills: [github-repo-management, github-auth]
---

# Sync a non-git local folder into an existing remote repo

For the request "push my local folder X to repo Y" where X is **not** a git repo and
Y **already has content**. Covers the safe, non-destructive path: investigate first,
ask before overwriting, then sync into the right location with `rsync` and verify.

## When to use

- "给我 push 到 https://github.com/owner/repo" and the local path is a plain folder (no `.git`).
- The remote repo already exists and may already contain an older/related copy of the same project.
- Local content maps to a NESTED subdirectory of the repo, not necessarily the root.

## Step 1 — Investigate before touching anything

```bash
# (a) Is the local folder a git repo?
git -C ~/Desktop/my-folder status 2>&1        # "not a git repository" => no .git

# (b) Does the remote exist / have content? (SSH auth must already work: `ssh -T git@github.com`)
git ls-remote git@github.com:owner/repo.git   # empty output = new repo; refs = has commits

# (c) Does local content map to repo ROOT or a NESTED subdir? Clone + diff:
git clone git@github.com:owner/repo.git /tmp/check
diff -rq --exclude='.git' --exclude='node_modules' --exclude='dist' \
  ~/Desktop/my-folder/ /tmp/check/some-subdir/
# "Only in <local>" = new files; "Only in <remote>" = remote-only files; "differ" = modified.
```

Key insight: if the repo already contains a nested folder that is nearly identical to the
local folder, the local folder is the SOURCE OF TRUTH for that subdir — sync into it.

## Step 2 — If remote has content and structure is ambiguous, ASK

Do NOT `git init && git push --force`. That silently destroys remote history/content.
Use `clarify` with explicit options:
1. Sync into the nested subdir (preserve existing structure) — usually the safe default.
2. Force-push to replace the whole repo (destructive).
3. Push as a new branch (leave `main` untouched).

## Step 3 — Sync with rsync (NO --delete)

`rsync -a` WITHOUT `--delete`: overwrites changed files, adds new files, and **leaves
remote-only files intact** — exactly "update my latest changes, keep existing structure".
Trailing slashes matter: `src/` → `dest/` copies the *contents*; `src` (no slash) creates `dest/src/`.

```bash
git clone git@github.com:owner/repo.git /tmp/work          # fresh FULL clone
rsync -a \
  --exclude='.git' --exclude='node_modules' --exclude='dist' \
  --exclude='__pycache__' --exclude='*.pyc' --exclude='.DS_Store' \
  --exclude='*.db' --exclude='packages/*/data' \
  ~/Desktop/my-folder/ /tmp/work/nested-subdir/
cd /tmp/work && git status --short                          # review BEFORE committing
```

## Step 4 — Exclude artifacts, commit, push, verify

Exclude runtime/generated junk from the sync (and thus from git): `node_modules`, `dist`,
`__pycache__`, `*.db` (SQLite runtime DBs), and any large **unsanitized** original when a
sanitized copy already lives in the project (e.g. a 14MB report vs its 150KB `*-sanitized.html`).

```bash
cd /tmp/work
git add nested-subdir/
git commit -m "feat: <summary of what changed>"
git push origin main
git ls-remote origin main    # VERIFY: returned hash must equal the local commit hash
```

## Pitfalls

- rsync trailing slash: `src/` copies contents into dest; `src` (no slash) nests it under `dest/src/`.
- Prefer a fresh FULL clone (not `--depth 1`) in `/tmp` as the working copy.
- git `user.name/email` (commit author) is independent of the SSH identity — `ssh -T git@github.com`
  prints the account that actually authenticates the push; both can differ and still succeed.
- After syncing, tell the user explicitly what was included and what was excluded (and offer to
  add back anything they actually want, e.g. the large original report).
- Always `git status --short` and eyeball the diff stat BEFORE committing — it catches accidental
  inclusions (a stray `.db`, a huge file, an untracked dir) before they hit the remote.
