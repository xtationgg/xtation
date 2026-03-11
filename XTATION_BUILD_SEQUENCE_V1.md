# XTATION Build Sequence V1

## Purpose

This document defines the practical build order for Xtation.

It answers:

- what should be built first
- what can run in parallel
- what should wait
- how to reduce architecture drift
- how to turn the locked specs into a real product

This is the execution map after the architecture pass.

## Core Rule

Xtation should not be built by section popularity.

It should be built by:

- dependency order
- user value
- stability
- business readiness
- future extensibility

The right question is not:

- what sounds coolest next

The right question is:

- what unlocks the most future value without creating chaos

## Current State Summary

Right now Xtation has:

- a strong quest/session/XP core
- auth foundations
- settings foundations
- multiplayer experiments
- early store/profile/inventory concepts
- locked architecture docs
- locked platform, Dusk, Lab, theme/skin, avatar, and admin specs

Right now Xtation does not yet have:

- one unified domain layer across all sections
- one clean section shell matching the locked architecture
- one finished user-facing primary flow
- one real admin console
- one finished Dusk runtime
- one theme/skin implementation

That means the project is architecturally rich but still operationally early.

## The Real Product Spine

The product spine is:

```txt
Account
-> Onboarding
-> Play
-> Profile
-> Lab
-> Dusk
-> Multiplayer
-> Store
```

Everything else should support that spine.

## Recommended Build Tracks

Xtation should be executed through these tracks:

```txt
Track A
- Core Cleanup and Shared Contracts

Track B
- Play V1

Track C
- Lab V1

Track D
- Dusk V1

Track E
- Profile and Self Tree Unification

Track F
- Inventory Unification

Track G
- Platform, Admin, Billing, Release Ops

Track H
- Multiplayer / People Ops V2

Track I
- Theme, Skin, Avatar, Scene Integration

Track J
- Store and Entitlements
```

These tracks are not equal in priority.

## Build Order

## Phase 0: Core Cleanup

This phase must happen before broad new implementation.

### Goals

- reduce duplicate models
- lock naming
- clean cross-section contracts
- stop architecture drift

### Main tasks

- treat `Quest` as the canonical product term
- map existing internal `Task` usage to a migration path
- define support objects in code:
  - `Attachment`
  - `EntityLink`
  - `EngineEvent`
  - `CalendarItem`
- stop adding one-off player/item/media object shapes in random files
- clean old branding leftovers where low-risk

### Why it matters

Without this phase, every later section will fork the domain again.

## Phase 1: Platform and Admin Foundations

This phase should run very early, not at the end.

### Goals

- make Xtation operable as a real product
- create safe user/account/business controls
- prepare for beta users and trials

### Main tasks

- role model
- release channels
- feature flags
- plan/trial model
- audit model
- backup and environment discipline
- admin route/system shell later

### Why it matters

You do not want real users before you can support, test, and roll out safely.

## Phase 2: Play V1

This is the most important user-facing build.

### Goals

- make Xtation feel real immediately
- create one strong daily-use workflow

### Play V1 should include

- active quest panel
- start/pause/resume session
- step flow
- linked resources
- linked people later if ready
- linked place later if ready
- reward and debrief state

### Why Play comes early

Play is where all the planning turns into value.
If Play is weak, the whole product feels theoretical.

## Phase 3: Lab V1

Lab should be the next major product system after Play.

### Goals

- make system-building real
- give users a reason to stay and organize their work

### Lab V1 should include

- Workspace home
- Knowledge vault
- Notes
- Templates
- simple Automations
- Assistant Projects shell

### V1 should avoid

- giant plugin marketplace
- unbounded assistant chat chaos
- overly abstract visual complexity

## Phase 4: Dusk V1

Dusk should come after Play and Lab are concrete enough to control.

### Goals

- create a real assistant runtime
- keep it useful offline
- make it safe and permissioned

### Dusk V1 should include

- compact command surface
- local offline actions
- explicit tool calls
- approval model
- provider configuration later in Settings
- Lab assistant project integration

### Why not first

If Dusk ships before Play and Lab have clear structures, Dusk becomes a chat wrapper around unfinished systems.

## Phase 5: Profile and Self Tree Unification

This phase should happen once Play and Lab are strong enough to feed meaningful history.

### Goals

- turn Profile into a real identity and memory surface
- clean self-tree integration

### Main tasks

- unify profile storage
- self-tree object and UI alignment
- history and timeline cleanup
- calendar integration
- avatar lobby shell later in this track

## Phase 6: Inventory Unification

Inventory should be rebuilt once links and attachments are stable.

### Goals

- make Inventory useful across the system
- separate assets from raw media records

### Main tasks

- unify InventoryItem with attachments
- support capability/link concepts
- connect to quests/projects/players/places
- prepare for avatar loadout and store entitlements later

## Phase 7: Theme, Skin, Avatar, Scene Integration

This phase should come after the core experience is stable enough to deserve richer presentation.

### Goals

- make Xtation visually distinct without breaking usability
- introduce the avatar and lobby meaningfully

### Main tasks

- semantic token implementation
- theme/skin settings integration
- scene quality settings
- profile avatar lobby foundation
- play exercise/avatar hooks

### Why not earlier

If done too early, the project becomes presentation-heavy before the product loop is strong.

## Phase 8: Multiplayer / People Ops V2

Multiplayer should be rebuilt after the personal system is stable.

### Goals

- make people, coordination, and discovery useful
- avoid social feature sprawl

### Main tasks

- player library
- people dossiers
- relationship and privacy model
- shared quests and rooms
- places integration
- optional operations workflows

### Why later

A weak solo product with multiplayer added on top rarely works.

## Phase 9: Store and Entitlements

Store should come after themes, skins, templates, modules, and packs have real targets.

### Goals

- monetize expansions cleanly
- support grants, trials, and catalog operations

### Main tasks

- entitlement model
- catalog surfaces
- settings/store linkage
- admin catalog management
- free vs paid pack logic

### Why later

Store should sell value, not unfinished promise.

## Phase 10: Desktop and Companion Expansion

This phase should deepen platform delivery after the product loop is stable.

### Goals

- make desktop first-class
- make mobile useful without overpromising parity

### Main tasks

- Electron hardening and polish
- offline behavior validation
- PWA and installability cleanup
- lightweight mobile companion

## What Can Run In Parallel

Some work can overlap safely.

### Safe parallel pairs

- Platform/Admin with Play
- Lab with Dusk planning
- Inventory cleanup with Profile planning
- Theme token prep with Store planning

### Unsafe parallel overlaps

- multiple agents changing core quest/session models at once
- Profile and Inventory both redefining identity/resource objects
- Dusk and Lab both inventing separate assistant models
- Store and Settings both inventing separate entitlement or skin state

## What Should Wait

These should stay delayed until the earlier phases are stable:

- heavy real-time chat
- live multi-user scene editing
- big plugin marketplace
- advanced team billing
- deep map platform as its own empire
- aggressive AI autonomy
- highly custom avatar builder

## Current Recommended Immediate Sequence

From today, the best next execution order is:

1. finish architecture locking docs
2. do core cleanup tasks
3. start Play V1 implementation
4. start Lab V1 implementation
5. start Dusk V1 shell
6. start admin shell and flag model

That is the highest-leverage path.

## Section Success Criteria

A section should not be called "done" because it has many panels.

A section is successful when:

- it has a clear purpose
- it is understandable in seconds
- it improves the real product loop
- it fits the locked architecture
- it does not create duplicate truth

## Final Lock

Xtation should be built like this:

- stabilize the foundation
- make Play strong
- make Lab real
- give Dusk clear tools
- unify Profile and Inventory
- then add richer presentation, people systems, and monetized expansions

The product should become useful before it becomes huge.
