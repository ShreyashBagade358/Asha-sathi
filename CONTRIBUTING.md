# Contributing to ASHA Sathi

Thank you for contributing to ASHA Sathi! This document describes the branching
model, commit conventions, PR process and code style we use.

## Getting started

1. Fork the repository and clone it.
2. Run `./scripts/setup-dev.sh` to bootstrap the dev environment.
3. Create a feature branch (see below).

## Branching model

We use a simplified **GitHub flow with `develop`**:

```
main  ───────────────  (production, tagged releases vX.Y.Z)
   │
develop ─────────────  (integration branch; auto-deploys to staging)
   │
   ├── feature/anc-offline-sync
   ├── fix/otp-phone-validation
   └── chore/dependabot-alerts
```

| Branch                       | Created from | Merges into | Deploys to     |
| ---------------------------- | ------------ | ----------- | -------------- |
| `main`                       | –            | –           | production     |
| `develop`                    | `main`       | `main`      | staging        |
| `feature/*`                  | `develop`    | `develop`   | – (PR only)    |
| `fix/*` / `hotfix/*`         | `develop`    | `develop`   | – (PR only)    |
| `docs/*` / `chore/*`         | `develop`    | `develop`   | – (PR only)    |

Rules:

- Never commit directly to `main` or `develop`.
- `hotfix/*` branches may be cut from `main` for urgent production fixes and are
  merged back to both `main` and `develop`.
- Keep branches short-lived (< 2 weeks) and rebase on `develop` frequently.

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org):

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:

| Type       | Purpose                                    |
| ---------- | ------------------------------------------ |
| `feat`     | new feature                                |
| `fix`      | bug fix                                    |
| `docs`     | documentation only                         |
| `style`    | formatting / whitespace (no code change)   |
| `refactor` | code change that neither fixes nor adds    |
| `perf`     | performance improvement                    |
| `test`     | adding/updating tests                      |
| `chore`    | tooling, deps, CI, build                   |

Examples:

```
feat(sync): add conflict resolution for beneficiary records
fix(auth): validate Indian mobile number before sending OTP
docs(abdm): document M2 consent request flow
chore(deps): bump fastapi to 0.110
```

Scopes: `backend`, `web`, `mobile-asha`, `mobile-patient`, `mobile-phc-admin`,
`ml`, `infra`, `ci`, `docs`, `deps`, `db`.

## Pull request process

1. Create a PR against the base branch (`develop` for features, `main` for hotfixes).
2. Title the PR with a conventional commit message.
3. Fill in the PR template: **Summary · Changes · Testing · Screenshots (UI) · Related issues**.
4. Keep PRs focused — one logical change per PR, < 500 lines preferred.
5. CI must pass: lint → test → build. A PR that breaks CI will not be merged.
6. Request review from the matching code owner (see `CODEOWNERS`):
   - backend → `@asha-sathi/backend`
   - mobile apps → `@asha-sathi/mobile`
   - web-dashboard → `@asha-sathi/web`
   - infra/CI/scripts → `@asha-sathi/devops`
7. After approval, use **Squash and merge** (keeps `develop` history clean).
8. Delete the branch after merge.

## Code style

### Python (backend)

- Ruff with the repo config (`ruff check`, `ruff format`).
- Target Python 3.11+, async-first (SQLAlchemy async sessions, no blocking calls in route handlers).
- Type-annotate everything; mypy must pass.
- Business logic lives in `app/services`, routes stay thin.

### TypeScript / React (dashboard)

- Prettier (`singleQuote`, `trailingComma: all`, `printWidth: 100`).
- Strict TypeScript; no `any` unless truly unavoidable and documented.

### Dart / Flutter (mobile)

- `dart format` (repo-wide via melos).
- `flutter analyze` with zero warnings.
- Models generated with `freezed` / `json_serializable` (`melos run generate:code`).

### Git hygiene

- Write descriptive commit messages (conventional).
- Do not commit secrets, `.env*`, build artifacts, models or large binaries.
- Keep `pnpm-lock.yaml`, `pubspec.lock` and lockfiles up to date in the same PR as dependency changes.

## Testing requirements

- **Backend:** new/changed behaviour must have pytest coverage; run `pytest --cov=app`.
- **ML:** training/eval code must keep `apps/ml-training` pytest suite green.
- **Web:** add/update Vitest or component tests for changed logic.
- **Mobile:** add Flutter widget/unit tests where practical; CI skips when no tests exist.
- Smoke test the API: `curl localhost:8000/health` should return 200.

## Reporting issues

- Use GitHub Issues with the appropriate label (`bug`, `enhancement`, `security`, `p1`...).
- Security issues: report privately to the maintainers before opening an issue.
