---
trigger: model_decision
description: "Apply when reading or updating memory-bank/ files, writing ADRs, or at session start/end"
---

# 04 — Memory Bank & Documentation Rules

These rules define how to maintain the `memory-bank/` directory and project documentation so that AI agents and team members can resume work accurately after a context reset.

---

## 1. Memory Bank Purpose

The `memory-bank/` directory is the **single source of truth** for project context across sessions. It must be kept accurate and current at all times.

After every memory reset, the AI reads ONLY these files. If the memory bank is stale or incomplete, the AI will produce incorrect code.

**Read order (mandatory at session start):**

1. `projectbrief.md`
2. `productContext.md`
3. `systemPatterns.md`
4. `techContext.md`
5. `activeContext.md`
6. `progress.md`

---

## 2. Core File Responsibilities

| File                | Owner          | Updated When                    |
| ------------------- | -------------- | ------------------------------- |
| `projectbrief.md`   | Project lead   | Project scope changes           |
| `productContext.md` | Project lead   | Business requirements change    |
| `systemPatterns.md` | Tech lead      | Architecture decisions change   |
| `techContext.md`    | Tech lead      | Dependencies, DB, infra changes |
| `activeContext.md`  | AI / Developer | After every significant task    |
| `progress.md`       | AI / Developer | After every significant task    |

---

## 3. `activeContext.md` — What It Must Contain

This file tracks **what is happening right now**. It must answer:

```markdown
## Current Focus

What specific task/feature is currently being worked on.

## Recent Changes

- What was changed in the last 1-3 sessions (file names, patterns, decisions)

## Active Decisions

- Open questions or choices that were made but need review

## Next Steps

- Concrete next actions (ordered by priority)

## Known Issues

- Bugs, regressions, or incomplete implementations
```

Rules:

- Update `activeContext.md` **at the end of every session** that made significant changes.
- Do NOT let `activeContext.md` grow stale — outdated context is worse than no context.
- Do NOT copy-paste full code into `activeContext.md` — reference file paths and describe the change.

---

## 4. `progress.md` — What It Must Contain

This file is a living status board. It must have three sections:

```markdown
## What Works

- Feature/module name: brief status and any caveats

## What's Left to Build

- Feature/module name: what remains, complexity estimate

## Known Issues

- Issue description: severity, affected service, workaround if any
```

Rules:

- Move items from "What's Left to Build" to "What Works" when a feature is verifiably complete.
- Do NOT mark something as "done" if it lacks tests or has known edge cases.
- Keep entries concise — one line per item is enough.

---

## 5. `systemPatterns.md` — What It Must Contain

Document architectural decisions that would be non-obvious to a new engineer:

```markdown
## Architecture Style

Orchestrated Saga via RabbitMQ — Gateway publishes, Processor orchestrates.

## Key Patterns

- Idempotency: 3-layer guard (gateway DB check → orchestrator status check → ledger entry check)
- Balance Update: Atomic @Modifying SQL (never read-modify-write in Java)
- Compensation: compensateIfNeeded() with null guard, swallows compensation exceptions

## Inter-Service Communication

- Async: RabbitMQ topic exchange, manual ACK, prefetch=1
- Sync: Spring Cloud OpenFeign (internal), RestClient (external APIs)

## Database Schema

- SELL_FOREIGN_USER: transaction state
- CORE_BANKING_USER: accounts + ledger entries

## Error Code Namespacing

- 3xxx: service-local business errors
- 6xxx: messaging errors
- conghung-commons ResponseCode: common errors
```

---

## 6. Documentation Update Triggers

Update the memory bank when:

| Trigger                            | Files to Update                                      |
| ---------------------------------- | ---------------------------------------------------- |
| New microservice added             | `systemPatterns.md`, `techContext.md`, `progress.md` |
| New database table added           | `systemPatterns.md`, `techContext.md`                |
| API contract changed               | `systemPatterns.md`, `activeContext.md`              |
| Dependency added/removed           | `techContext.md`                                     |
| Architecture decision made         | `systemPatterns.md`, `activeContext.md`              |
| Feature completed                  | `progress.md`, `activeContext.md`                    |
| Bug discovered                     | `progress.md` (Known Issues)                         |
| Session ends with significant work | `activeContext.md`, `progress.md`                    |

---

## 7. Architecture Decision Record (ADR)

For significant, irreversible decisions, write a brief ADR inside `memory-bank/` or `docs/`:

```markdown
## ADR-001: Manual ACK mode for RabbitMQ

**Date**: 2026-06-06
**Status**: Accepted

**Context**:
Auto-ACK mode would acknowledge the message before business logic completes,
risking message loss on crash between ACK and successful DB write.

**Decision**:
Use manual ACK mode. Call basicAck only after the transaction is confirmed.

**Consequences**:

- Messages may be re-delivered on processor restart — idempotency guard required.
- basicNack must use requeue=false to prevent infinite retry loops.
```

Rules:

- Write an ADR for every decision that would be surprising to a new engineer.
- ADRs are immutable once accepted — do NOT edit past ADRs; add new ones to supersede.
- Link ADR from `systemPatterns.md` when relevant.

---

## 8. Inline Code Documentation Rules

### When to write a comment

Write a comment when the **why** is not obvious from the code:

```java
// requeue=false: a permanently-failed message must not loop back to the queue.
// It will be routed to the DLQ if configured.
channel.basicNack(deliveryTag, false, false);

// WHERE guard: prevents overdraft at the DB level without a Java-layer read.
// If rows == 0, the balance was insufficient — throw immediately.
int rows = accountRepository.holdFundsAtomically(accountId, amount, currency);
if (rows == 0) throw new BusinessException(ResponseCode.INSUFFICIENT_FUNDS, ...);
```

### When NOT to write a comment

Do NOT comment what the code already clearly states:

```java
// BAD: obvious from code
// Set status to PROCESSING
transaction.setStatus(TransactionStatus.PROCESSING);

// BAD: restates method name
// Save the transaction
transactionRepository.save(transaction);
```

Rules:

- Comments explain **why**, not **what**.
- Remove stale comments that no longer reflect reality — they are worse than no comment.
- Use Javadoc (`/** */`) only on public API interfaces and service methods, not on private helpers.

---

## 9. README Maintenance Rules

Every project must have a `README.md` that includes:

- **Purpose**: what the service/system does in 2-3 sentences
- **Architecture diagram**: high-level service topology
- **Prerequisites**: Java version, Docker, required env variables
- **How to run locally**: exact commands, not general instructions
- **How to run tests**: exact command
- **Key endpoints**: list the most important API endpoints
- **Environment variables**: table of all required config with examples

Rules:

- README must be updated when any of the above sections changes.
- Do NOT copy architecture from docs into README — link to the docs file instead.
- README must be accurate enough for a new engineer to run the project in under 15 minutes.
