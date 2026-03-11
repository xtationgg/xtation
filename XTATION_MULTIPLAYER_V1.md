# XTATION Multiplayer V1

## Purpose

Multiplayer is not a single page. It is the people layer of Xtation:

- `HQ` is the triage surface.
- `People` manages dossiers, network coverage, and outreach.
- `Spaces` manages collaboration rooms, tasks, and proposals.
- `Map` manages pins, saved places, and live sharing.
- `Signals` manages comms, rank, and trace.
- `Ops` handles routing, export, diagnostics, and safety controls.

## Shell Model

The multiplayer shell should stay simple at the top:

- six primary surfaces only
- one reliable vertical scroll plane
- progressive disclosure for advanced tools
- triage queue before heavy editors
- inbox-style signals instead of action spam

Advanced workstations can still exist, but they should open inside collapsible sections and never define the primary shell shape.

## Source Of Truth

- `players`, `pins`, `collabs`, `xpLogs`, `sharingByPlayer`, `myLocation`, `savedLocations`
  - stored in user-scoped multiplayer storage
- `threads`, `messages`
  - stored in user-scoped messages storage
- `auditLog`
  - stored in user-scoped multiplayer storage
- `settings`
  - owned by the canonical settings engine and mirrored into multiplayer permissions

## Snapshot Layer

`src/multiplayer/metrics.ts` derives the command snapshot used across views:

- readiness score
- role and tag breakdown
- timezone breakdown
- nearby players
- risk flags
- recommendations
- communications counts
- audit/trace counts
- recent cross-system activity

The shell should treat this as projection state, not primary persistence.

## Communications Rules

- threads are linked to player ids when possible
- messages can exist before real backend sync
- unread state is local-first
- orphan threads are allowed but should be surfaced as repair work
- the message layer should be reachable from squad, network, intel, and earth

## Trace Rules

The trace log records major multiplayer actions:

- player add/remove
- pin add/update/remove
- location share start/stop
- collaboration creation and proposal review
- XP logging
- diagnostics/export actions
- comms thread creation and briefing seed

This is the first stable event surface for future Lab automation.

## Future Cloud Boundaries

Good candidates for Supabase sync later:

- player identity and permissions
- collaborations and proposals
- pins and saved locations
- direct message threads/messages
- audit summaries or lab-trigger events

Keep local-first for now:

- viewer simulation
- temporary shell routing state
- transient focus/open states

## Near-Term Next Steps

1. Replace the local `"me"` player with a real auth-backed multiplayer profile record.
2. Define multiplayer sync schema in Supabase for players, collaborations, pins, and threads.
3. Make `Trace` the canonical event feed for Lab triggers.
4. Connect store entitlements to multiplayer cosmetics, themes, and observer modules.
