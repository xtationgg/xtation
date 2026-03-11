# XTATION Operating Model V1

## Purpose

This document defines how Xtation should be developed from this point forward.

It exists to prevent:

- scattered parallel decisions
- section drift
- duplicated architecture
- feature sprawl
- design inconsistency

The model assumes one chief architecture mind and multiple scoped worker tracks.

## Core Roles

### Chief Mind

The chief mind owns:

- product direction
- architecture boundaries
- design consistency
- final tradeoff decisions
- section review and approval
- cross-section integration rules

The chief mind should continuously ask:

- is this useful?
- is this clear?
- is this still Xtation?
- is this becoming too complicated?
- is there a simpler version with equal or better power?

### Worker Tracks

Worker tracks may be created for:

- Play
- Profile
- Lab
- Multiplayer
- Inventory
- Store
- Settings
- Platform / Admin / Ops
- Dusk
- Avatar / Scene

Each worker track must stay inside its section charter and avoid redefining shared domain objects without review.

## Shared Source Of Truth

The following docs are the current architecture anchors:

- `XTATION_LOCKED_ARCHITECTURE_V1.md`
- `XTATION_SYSTEM_MAP_V1.md`
- `XTATION_MULTIPLAYER_V1.md`

New section work should either:

- follow these docs
- or produce a reviewed update to them

It should not silently invent a parallel system.

## Section Workflow

Each section should be developed in cycles.

### Cycle 1: Research

For the active section:

- inspect current repo reality
- inspect user goals
- inspect adjacent sections
- research current market/tool patterns when helpful
- identify what should be copied, adapted, or rejected

### Cycle 2: Lock Scope

Before implementation:

- define what the section owns
- define what it reads from other sections
- define what it must not own
- define the minimum useful version

### Cycle 3: Implement

Implementation should favor:

- local-first correctness
- simple surface area
- progressive disclosure
- stable object boundaries

### Cycle 4: Review

Every section pass must be reviewed against:

- architecture fit
- duplication risk
- UX clarity
- visual coherence
- performance impact
- offline behavior
- admin / safety implications where relevant

### Cycle 5: Back Up

After a meaningful milestone:

- create a clean source backup
- record what changed
- record what still feels weak

### Cycle 6: Reopen

After a section is "done enough", reopen it with fresh review:

- what still feels heavy?
- what still feels duplicated?
- what is technically correct but UX-wrong?
- what did adjacent systems reveal?

No section should be considered permanently finished after one pass.

## Mandatory Review Gates

Before closing a section cycle, run:

1. Build check
2. Relevant tests if available
3. Architecture check
4. UX simplification check
5. Cross-section integration check
6. Backup creation if milestone-worthy

## Design Rules

Xtation should feel:

- clean
- deliberate
- high-agency
- cinematic in selected places
- calm under complexity

Xtation should not feel:

- noisy
- over-paneled
- fake-advanced
- cluttered by equal-priority actions

Visual rule:

- strong identity
- simple information hierarchy
- bold but controlled motion
- fewer competing surfaces

Interaction rule:

- one primary action per area
- advanced controls behind progressive disclosure
- direct utility before visual spectacle

## Research Rules

The chief mind may browse and research when:

- a decision could be outdated
- current market patterns matter
- security, billing, deployment, or platform choices are involved
- a new library or tool may reduce complexity or increase quality

Research should not be used to copy products blindly.
It should be used to improve judgment.

## External Dependency Rules

New external tools, libraries, or skills may be added when they clearly improve:

- implementation quality
- testing quality
- deployment quality
- documentation quality
- security posture

Avoid dependency sprawl.
Every addition should have a clear reason.

## Backup Rules

Use clean source backups for milestones.

Backups should normally exclude:

- `node_modules`
- build outputs
- local helper state
- secrets where possible

Backup naming should include date and time.

## Section Priority

Current preferred priority:

1. Core domain cleanup
2. Play
3. Lab
4. Profile cleanup
5. Multiplayer people ops
6. Inventory unification
7. Store
8. Admin / business systems as parallel platform track

This priority may be revised when new architectural facts emerge.

## Dusk / Avatar Rule

Do not collapse these into one system.

- Dusk = assistant character and command layer
- Avatar = user representation
- Scene runtime = 3D rendering module

They may connect, but they are not the same object.

## Final Operating Principle

Xtation should be improved in loops, not in one-shot feature bursts.

Every loop should leave the product:

- clearer
- more unified
- more useful
- more defensible

If a new idea increases complexity without increasing real leverage, it should be delayed or rejected.
