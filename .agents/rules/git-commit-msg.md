---
trigger: model_decision
description: "Apply when writing a git commit message or running git commit/push"
---

# Git Commit Message Convention

> Adapted from [Karma Runner Git Commit Msg](https://karma-runner.github.io/6.4/dev/git-commit-msg.html) and [Angular Commit Message Format](https://github.com/angular/angular/blob/master/CONTRIBUTING.md#commit), customized to this project's **bracket layout**.

---

## Why This Convention?

- **Automatic changelog generation** from git history
- **Simple navigation** through git history (e.g. ignoring style changes)
- **Semantic versioning** — commit type determines version bump (MAJOR / MINOR / PATCH)
- **Ticket traceability** — every commit links to its ticket id

---

## Canonical Format (THIS PROJECT)

This project uses the **bracket layout** (not the plain Angular `type(scope):` layout):

```
<type>[<id-ticket>]:[<scope>]:<message>

<body>

<footer>
```

Header (first line) is **mandatory**; body and footer are optional (recommended for non-trivial changes), each separated by a blank line.

**Real examples from this repo:**

```
docs[MICRO-006]:[memory-bank]:update memory bank for TS-014 refactor plan
fix[MICRO-006]:[order-service]:return OrderResponse DTO to fix SpotBugs ENTITY_LEAK
hotfix[AR-2026]:[token-leak-issue]:fix token leak when reading API response
```

> [!IMPORTANT]
> - The **header** is mandatory. Keep it ≤ **100 characters** (the bracket prefix + ticket + scope consume budget; the plain-Angular 72-char limit is too tight here). Keep the `<message>` portion itself concise.
> - `<type>`, `<id-ticket>`, `<scope>` and `<message>` are all **lowercase** except the ticket id (which follows the tracker's casing, e.g. `MICRO-006`, `TS-015`).

---

## 1. `<type>` (Required)

One of the following **lowercase** values:

| Type       | Description                                                       | Version Bump |
| ---------- | ---------------------------------------------------------------- | ------------ |
| `feat`     | A new feature for the **user** (not build scripts)               | **MINOR**    |
| `fix`      | A bug fix for the **user** (not build scripts)                   | **PATCH**    |
| `hotfix`   | An urgent fix shipped outside the normal flow                    | **PATCH**    |
| `perf`     | Performance improvements                                         | **PATCH**    |
| `docs`     | Documentation only changes                                       | None         |
| `style`    | Formatting, missing semicolons, etc. (no production code change) | None         |
| `refactor` | Refactoring production code (e.g. renaming a variable)           | None         |
| `test`     | Adding or refactoring tests (no production code change)          | None         |
| `build`    | Build config, dev tools, or changes irrelevant to the user      | None         |

## 2. `[<id-ticket>]` (Required)

The tracking ticket id in square brackets, e.g. `[MICRO-006]`, `[TS-015]`, `[AR-2026]`.
- If there is genuinely no ticket, use the closest identifier (epic, `NO-TICKET`) — do not leave it empty.

## 3. `[<scope>]` (Required)

The area of the codebase affected, in square brackets, **lowercase**.

| Scope      | When to Use                                            |
| ---------- | ----------------------------------------------------- |
| `order-service` / `product-service` / `account-service` / `mail-service` / `api-gateway` | The affected microservice module |
| `memory-bank` | Memory bank docs                                    |
| `auth`     | Authentication & authorization (JWT, SecurityConfig)  |
| `config`   | Configuration files (application.yaml, profiles)      |
| `db`       | Database migrations, entities, repositories           |
| `api`      | API response format, error handling, global exception |
| `ci` / `main-workflow` | CI/CD workflows                           |
| `docker`   | Docker, docker-compose                                |
| `deps`     | Dependency updates, CVE fixes                         |

## 4. `<message>` (Required)

- Use **imperative, present tense**: "add" not "added" nor "adds"
- **Do not capitalize** the first letter
- **No period (.)** at the end
- Keep it concise so the whole header stays ≤ 100 chars

**Good:** `feat[MICRO-007]:[order-service]:add create order endpoint with idempotency guard`
**Bad:** `feat[MICRO-007]:[order-service]:Added create order endpoint.` (past tense, capitalized, trailing period)

---

## 5. Body (Optional)

- Imperative, present tense (same as message)
- Include **motivation** and **contrast with previous behavior**
- Wrap lines at ~72 characters

```
fix[MICRO-006]:[order-service]:return OrderResponse DTO instead of entity

OrderController returned List<Order> (a MongoDB @Document), tripping the
FindSecBugs SPRING_ENTITY_LEAK rule and failing the SpotBugs gate.
Introduce OrderResponse + OrderMapper so the entity is no longer exposed.
```

---

## 6. Footer (Optional)

### 6.1 Referencing Issues
Closed issues on a separate line, prefixed with `Closes`:
```
Closes #234
Closes #123, #245, #992
```

### 6.2 Breaking Changes
All breaking changes **must** be in the footer with description, justification, migration notes:
```
BREAKING CHANGE: `getUserById` now returns Optional<User> instead of User.
To migrate, update all callers to handle the Optional wrapper.
```

> [!CAUTION]
> Any commit with a `BREAKING CHANGE` footer triggers a **MAJOR** version bump.

---

## 7. Quick Reference Checklist

Before committing, verify:

- [ ] Layout is `<type>[<id-ticket>]:[<scope>]:<message>`
- [ ] Type is one of: `feat`, `fix`, `hotfix`, `perf`, `docs`, `style`, `refactor`, `test`, `build`
- [ ] Type, scope, and message are **lowercase** (ticket id keeps tracker casing)
- [ ] Message uses **imperative mood** ("add" not "added"), no trailing period
- [ ] Header line ≤ **100 characters**
- [ ] Body explains **why**, not just what
- [ ] Breaking changes documented in footer with `BREAKING CHANGE:`
- [ ] Related issues referenced with `Closes #xxx`

---

## 8. Antigravity CLI Execution Template (Delegated Git Commands)

When executing Git mutations (`git commit`, `git push`) via delegated CLI, wrap the commands in a redirected subshell block so detailed logs are captured while a clean status prints to the terminal.

```bash
mkdir -p .antigravitycli/logs
{
  echo "=== Git Commit & Push Start: $(date) ==="

  # 1. Stage files (use incremental adds for separate commits)
  git add <path/to/files>

  # 2. Commit using the canonical layout
  git commit -m "<type>[<id-ticket>]:[<scope>]:<message>"

  # 3. Push to the remote branch
  git push origin <branch-name>

  echo "=== Git Commit & Push Done: $(date) ==="
} > .antigravitycli/logs/git_push.log 2>&1

if [ $? -eq 0 ]; then
  echo '{"status": "success"}' > .antigravitycli/logs/git_push_result.json && echo "Git push thành công."
else
  echo '{"status": "error"}' > .antigravitycli/logs/git_push_result.json && echo "Git push thất bại. Xem log tại .antigravitycli/logs/git_push.log"
fi
```
