---
name: diagnose
description: Investigation workflow for bugs with no known cause. Hypotheses and evidence first, fix only after the root cause is confirmed.
when_to_use: "When the user reports a symptom whose cause is unknown, or asks why something behaves strangely, before any fix is attempted."
allowed-tools: Read, Grep, Glob, Bash
---

# Diagnose

Read [../../workflows/diagnose.md](../../workflows/diagnose.md) and follow that
procedure exactly, treating the user's message as its input.

That file is the single source of the procedure — do not restate or summarise it here.
Note its first rule: change no code until the root cause is confirmed with evidence.
