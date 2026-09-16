---
trigger: manual
---

# Software Development Rules

> Core essentials are always-on via root `AGENTS.md`. This is the full detailed reference — invoke with `@software-develop`.

> Practical engineering behavior for building software incrementally without breaking existing code.

---

## 0. Core Philosophy

Your primary job is **not to implement features**, but to: preserve **invariants**, isolate **change**, prevent **regressions**, and enable **future work at low cost**.

### Trade-off Analysis (MANDATORY for significant decisions)

Before adopting ANY technology, pattern, or architecture:

| Question | Purpose |
|---|---|
| **Why this?** | What specific problem does it solve in THIS context? |
| **Why not the alternative?** | What other options exist and why are they worse HERE? |
| **What do I gain?** | Concrete, measurable benefits |
| **What do I lose?** | Cost, complexity, operational burden |
| **When does it break?** | At what scale/scenario does this choice fail? |

**Anti-patterns:** "I use Redis because it is fast" (no context). "I use microservices because it scales" (no trade-off). "I use JWT because it is stateless" (no cost analysis).

---

## 1. Level-by-Level Development

### Rule 1.1 — Every Feature is a "Next Level"

Design as if Level N+1 is guaranteed. Before coding, ask:
- "What will Level N+1 probably change?"
- "Where should that change live?"

If you cannot answer → **do not code yet**.

### Rule 1.2 — One Level = One Commit

Each level is a cohesive increment. Never mix multiple conceptual changes in one commit.

---

## 2. Public API Stability

### Rule 2.1 — Public API Is a Contract

Once public: tests rely on it, users rely on it, future levels depend on it. **Breaking changes must be avoided or explicitly layered.**

### Rule 2.2 — Evolve APIs, Don't Replace Them

```java
T lowerbound();              // legacy — keep
Optional<T> lower();         // new, safer API — add
```

Allows backward compatibility, gradual migration, no test breakage.

---

## 3. Object Modeling

- **Model Concepts, Not Flags** — If you see `boolean isOpen; boolean isClosed;` you missed an abstraction.
- **Invariants Live in Constructors** — All invalid states must be impossible to create. Never rely on callers to "use it correctly".
- **Prefer Value Objects Over Primitives** — If a value has rules, wrap it. Value Objects encapsulate logic, eliminate duplication, localize change.

---

## 4. SOLID Applied

| Principle | Practical Rule |
|---|---|
| **S** — Single Responsibility | A class changes for ONE reason only. If a method has `if` for multiple reasons → split. |
| **O** — Open/Closed | New behavior via new types/strategies, not editing large `if/else` blocks. |
| **L** — Liskov Substitution | If `B extends A`, B must be usable wherever A is expected. Prefer `Comparable<? super T>` over `Comparable<T>`. |
| **I** — Interface Segregation | Expose only what callers need. Domain objects ≠ HTTP DTOs. |
| **D** — Dependency Inversion | High-level logic must not depend on parsing details, frameworks, or transport. Caller supplies dependency, domain stays pure. |

---

## 5. Pattern Selection

- Prefer **small, local patterns** (enum strategy, value object, factory method) before Visitor, Abstract Factory, or reflection.
- Patterns should **reduce code**, not increase it.
- Nested types when scope is local — do not extract prematurely.
- Before using any pattern: **understand WHY it exists, not just HOW to use it.**

---

## 6. Testing Rules (Non-Negotiable)

### Rule 6.1 — Tests Describe Behavior, Not Implementation

```java
// ✅ Tests what user cares about
assertThat(range.contains(5)).isTrue();

// ❌ Tests internal structure
assertThat(range.lower.kind()).isEqualTo(...);
```

### Rule 6.2 — Preserve Old Tests Forever

When adding a level: all previous tests **must still pass**. If they don't → you broke the contract.

### Rule 6.3 — Round-Trip Tests for Serialization

Whenever you add `toString()` + `parse()`: `assertThat(parse(r.toString()).toString()).isEqualTo(r.toString());`

---

## 7. Framework Isolation

- **Domain Must Not Depend on Frameworks** — Never `import org.springframework.*` in domain code. Frameworks change. Domain must not.
- **Caveat for flat-by-layer architecture:** When using flat-by-layer (small/medium services), entities in `model/` package ARE the persistence model. JPA annotations (`jakarta.persistence.*`) and Hibernate annotations (`org.hibernate.*`) on entities are acceptable — there is no separate domain model to protect. This trade-off is explicit: simpler structure at the cost of framework coupling. If the service grows into package-by-feature, extract domain objects at that point.
- **Controllers Are Glue Only** — Deserialize input → call domain → serialize output. Nothing else.

---

## 8. Final Checklist

Before committing any change:

- [ ] Did I preserve all existing behavior?
- [ ] Is the new logic isolated?
- [ ] Did I introduce any flags that hide concepts?
- [ ] Would Level N+1 be easy to add?
- [ ] Are tests describing behavior, not structure?
- [ ] Can I name what I sacrifice with this technical choice?

If any answer is "no" → stop and refactor.
