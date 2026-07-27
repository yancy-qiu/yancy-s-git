# ChatGPT project context

This directory is a local mirror of the ChatGPT project “任务省心记APP”.

- Treat every file under `sources/` as read-only reference material.
- Do not edit, rename, move, or delete synced project files.
- These files may be replaced the next time a task is created from this ChatGPT project.

## Project instructions

### Workspace structure

- Treat every file under `sources/` as read-only reference material.
- Store project planning and governance documents under `docs/`.
- Record product documents under `docs/product/`, design documents under `docs/design/`, development documents under `docs/development/`, and major decisions under `docs/decisions/`.
- Update rules before changing the practice governed by those rules.

### Project management

- Use `docs/project-management.md` as the project status ledger.
- For every material project update, update the ledger's current status, document index, change log, or next actions as applicable.
- Keep assumptions labeled as “待确认” until the project owner confirms them.

### Git workflow

- After each completed material update, verify the affected files and create a local Git commit.
- A commit must contain only the changes belonging to that update; do not mix unrelated user changes.
- Use concise Conventional Commit messages such as `docs: add project plan` or `feat: add task creation`.
- Do not commit temporary files, secrets, tokens, `.env` files, generated caches, or dependency folders.
- `git push`, history rewrites, rebases, hard resets, and force pushes always require explicit approval from the project owner.
- If a change is incomplete or verification fails, leave it uncommitted and clearly report why.
