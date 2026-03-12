# XTATION Continuation Map V1

## Purpose

This document is the continuity and handoff anchor for XTATION.

Use it when:

- a fresh chat needs to continue the project
- a different AI needs to take over
- the working thread is close to losing context
- someone needs one exact map of:
  - what XTATION is
  - what has been locked
  - what is implemented now
  - what is partially implemented
  - what is next
  - what must not be re-decided casually

This file should be read before broad repo exploration.

## Read First

For a fresh handoff, read in this order:

1. [XTATION_CONTINUATION_MAP_V1.md](/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_CONTINUATION_MAP_V1.md)
2. [XTATION_SPEC_INDEX.md](/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_SPEC_INDEX.md)
3. [XTATION_LOCKED_ARCHITECTURE_V1.md](/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_LOCKED_ARCHITECTURE_V1.md)
4. [XTATION_BUILD_SEQUENCE_V1.md](/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_BUILD_SEQUENCE_V1.md)
5. [XTATION_PLATFORM_BUSINESS_V1.md](/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_PLATFORM_BUSINESS_V1.md)
6. [XTATION_DUSK_V1.md](/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_DUSK_V1.md)
7. [XTATION_LAB_V1.md](/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_LAB_V1.md)
8. [XTATION_THEME_SKIN_V1.md](/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_THEME_SKIN_V1.md)
9. [XTATION_AVATAR_SCENE_V1.md](/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_AVATAR_SCENE_V1.md)
10. [XTATION_CREATIVE_OPS_V1.md](/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_CREATIVE_OPS_V1.md)
11. [XTATION_AUDIO_DIRECTION_V1.md](/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_AUDIO_DIRECTION_V1.md)
12. [XTATION_PRESENTATION_EVENT_TAXONOMY_V1.md](/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_PRESENTATION_EVENT_TAXONOMY_V1.md)
13. [XTATION_SCENE_STUDIO_INTEGRATION_V1.md](/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_SCENE_STUDIO_INTEGRATION_V1.md)

After that, inspect the current implementation surfaces:

- [App.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/App.tsx)
- [TopBar.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Layout/TopBar.tsx)
- [Play.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Play.tsx)
- [Profile.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Profile.tsx)
- [ProfileLobbyScene.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/ProfileLobbyScene.tsx)
- [Lab.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Lab.tsx)
- [HextechAssistant.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Features/HextechAssistant.tsx)
- [Admin.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Admin.tsx)
- [CreativeOpsPanel.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Admin/CreativeOpsPanel.tsx)
- [MultiplayerNew.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/MultiplayerNew.tsx)
- [Settings.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Settings.tsx)
- [Inventory.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Inventory.tsx)
- [Store.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Store.tsx)
- [index.css](/Users/sarynass/dyad-apps/CLient-D82pm/index.css)

## Locked Product Structure

XTATION uses this top-level structure:

```txt
XTATION
- Play
- Profile
- Lab
- Multiplayer
- Inventory
- Store
- Settings
```

Section meaning:

- `Play` = execute
- `Profile` = identity and history
- `Lab` = build systems
- `Multiplayer` = people / coordination / ops
- `Inventory` = assets and resources
- `Store` = skins / modules / expansions
- `Settings` = policy and configuration

Shared system layers:

- Dusk
- Places
- Self Tree
- Attachments
- Presentation Events
- Creative Ops

## Non-Negotiable Product Decisions

Do not casually undo these:

- XTATION is a personal operating system, not a generic dashboard.
- `Quest` is the canonical product term even if some internal files still say `Task`.
- `Dusk` is the assistant / command layer, not the user avatar.
- The user avatar and the 3D scene are separate from Dusk.
- Skins change presentation only:
  - theme
  - motion
  - sound
  - scene behavior
  - screen voice
  - avatar presentation
- Skins must not change core system logic.
- Admin owns creative authoring.
- Users consume published skins and simple settings, not raw creative controls.
- Presentation behavior is driven by semantic events, not button-id hacks.
- The authoritative review environment is the local app, not the slim public preview.

## Current Design Direction

Current visual direction:

- `Bureau + Amber` is the default station identity
- the target feel is closer to `Control` than generic SaaS
- dark command-shell surfaces
- small radii
- strong typography
- large negative space where possible
- thin borders, restrained motion, minimal color palette
- cleaner institutional / mission-control tone

Current active visual frontier:

- make `Profile` feel unmistakably scene-first
- reduce runtime/debug phrasing inside the profile scene overlay
- strengthen avatar-stage framing and silhouette before opening another major subsystem
- prefer source-side scene/runtime adjustments over stacking more host-side overlay chrome
- keep XTATION-side scene consumption clean while the external studio becomes the canonical authoring tool

Recent design consolidation has already been pushed through:

- top shell
- command palette
- welcome
- play
- profile
- admin / creative ops
- lab
- settings
- multiplayer
- dusk
- store
- inventory

This design pass is not “finished forever,” but the client is now much more coherent than the earlier mixed-era state.

## Recent Stability Fix

Important recent bug:

- the shell hit a runtime error reading `releaseChannel` because `App.tsx` was incorrectly reading `currentStation` from `state.currentStation`
- this is now fixed:
  - `App.tsx` reads the top-level `currentStation` from `useAdminConsole()`
  - `buildStationIdentitySummary(...)` now safely tolerates a missing station during boot

## Current Implemented State By Section

### Play

Implemented:

- real action-room structure
- active quest and queue flow
- session controls
- starter relay after onboarding
- routed starter-workspace cue from Play into Profile / Lab
- shell-level `Starter Route` confirmation strip for routed workspace jumps
- explicit `First session live` continuity transition once the seeded starter quest actually starts running
- automatic `Starter checkpoint` cue once the first routed starter action lands
- `Starter checkpoint` is now gated by a real milestone:
  - session starters wait for meaningful tracked work
  - instant starters can checkpoint on first real activation
- routed `Starter checkpoint` cues now carry the same confirmed milestone state into:
  - the shell strip
  - Profile starter cards
  - Lab starter cards
- those routed checkpoint cues now also carry an explicit route-live confirmation:
  - `Profile route live`
  - `Lab route live`
  with track-aware confirmation detail
- once the routed recommended action is actually taken, XTATION now shows a shared `Starter action confirmed` state in:
  - the shell
  - Profile
  - Lab
- that confirmed starter action is now also recorded in station activity/history using the same shared wording, so continuity surfaces can reflect the first real routed action too
- starter checkpoints are also written into station activity/history for later continuity review
- `Enter Local Station` now resumes the real stored local workspace instead of always snapping back to Play
- cross-section quest return into Play through a lightweight Play bridge
- destination-specific recommended next move carried into the routed workspace cue
- urgent watch / pressure signal
- improved command-shell styling

Main files:

- [Play.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Play.tsx)
- [workspaceCue.ts](/Users/sarynass/dyad-apps/CLient-D82pm/src/onboarding/workspaceCue.ts)
- [bridge.ts](/Users/sarynass/dyad-apps/CLient-D82pm/src/play/bridge.ts)

### Profile

Implemented:

- real 3D profile scene integrated into main app
- profile scene overlay recently compressed toward product UI:
  - no visible command count
  - no last-event noise
  - shorter stage status copy
  - lighter relay copy focused on mission / state / loadout
- profile scene framing recently strengthened:
  - lighter edge vignettes
  - stronger central glow
  - subtle focus frame around the avatar zone
  - tighter iframe crop/scale
- profile deck and runtime shell over the scene
- starter-workspace cue consumption for routed handoff from Play
- routed checkpoint cue now preserves the confirmed first-session milestone inside the profile starter card
- routed checkpoint cue now also preserves the route-live confirmation message inside the profile starter card
- taking the profile starter recommended action now raises a visible `Starter action confirmed` state instead of silently clearing the handoff
- direct `Open Quest` / `Brief Dusk` starter actions inside the profile deck
- profile starter cue now carries a local recommended action:
  - mission -> `Open Loadout`
  - practice -> `Open Stats`
- starter actions now run through a shared storage-backed workspace action bridge
- dismissing the profile starter cue also dismisses the shell route strip
- avatar loadout readiness states:
  - `empty`
  - `partial`
  - `ready`
- authored avatar pack influence on labels, slot language, badge, loadout identity
- scene runtime emits presentation telemetry

Important note:

- the main app uses the embedded scene runtime in:
  - [public/avatar-lobby/index.html](/Users/sarynass/dyad-apps/CLient-D82pm/public/avatar-lobby/index.html)
- the editable source snapshot is now also stored inside XTATION at:
  - [scene-source/avatar-lobby/README.md](/Users/sarynass/dyad-apps/CLient-D82pm/scene-source/avatar-lobby/README.md)
  - [scene-source/avatar-lobby/demo.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/scene-source/avatar-lobby/demo.tsx)
  - [scene-source/avatar-lobby/halide-topo-hero.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/scene-source/avatar-lobby/halide-topo-hero.tsx)
- the live rebuild path still comes from the original scene workspace at:
  - `/Users/sarynass/Desktop/html`
  - after source changes there, rebuild and resync `dist/` into `public/avatar-lobby/`

Main files:

- [Profile.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Profile.tsx)
- [ProfileLobbyScene.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/ProfileLobbyScene.tsx)
- [runtimePack.ts](/Users/sarynass/dyad-apps/CLient-D82pm/src/sceneStudio/runtimePack.ts)

### Lab

Implemented:

- Workspace
- Knowledge
- Baselines collection
- starter-workspace cue consumption for routed handoff from Play
- routed checkpoint cue now preserves the confirmed first-session milestone inside the Lab starter card
- routed checkpoint cue now also preserves the route-live confirmation message inside the Lab starter card
- taking the Lab starter recommended action now raises a visible `Starter action confirmed` state instead of silently clearing the handoff
- direct `Open Quest` / `Brief Dusk` starter actions inside the Lab workspace cue
- Lab starter cue now carries a local recommended action:
  - system -> `Open Knowledge`
- starter actions now run through a shared storage-backed workspace action bridge
- dismissing the Lab starter cue also dismisses the shell route strip
- Dusk promoted-baseline loop
- baseline history timeline
- baseline drift view
- provenance panel
- Lab bridge for cross-section navigation from Dusk

Main files:

- [Lab.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Lab.tsx)
- [LabProvider.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/src/lab/LabProvider.tsx)
- [bridge.ts](/Users/sarynass/dyad-apps/CLient-D82pm/src/lab/bridge.ts)
- [baselineDiff.ts](/Users/sarynass/dyad-apps/CLient-D82pm/src/lab/baselineDiff.ts)
- [baselineProvenance.ts](/Users/sarynass/dyad-apps/CLient-D82pm/src/lab/baselineProvenance.ts)

### Dusk

Implemented:

- local-first relay shell
- tool runtime
- provider-safe envelope
- managed provider sessions
- revision lifecycle:
  - planned
  - revised
  - accepted
  - discarded
  - executed
- accepted baseline compare workflow
- Lab promotion of accepted plans
- baseline-compare-aware revision decision panel
- managed trace cards with compare recommendation state

Main files:

- [HextechAssistant.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Features/HextechAssistant.tsx)
- [managedProviderSession.ts](/Users/sarynass/dyad-apps/CLient-D82pm/src/dusk/managedProviderSession.ts)
- [baselineCompare.ts](/Users/sarynass/dyad-apps/CLient-D82pm/src/dusk/baselineCompare.ts)
- [toolRuntime.ts](/Users/sarynass/dyad-apps/CLient-D82pm/src/dusk/toolRuntime.ts)
- [providerRun.ts](/Users/sarynass/dyad-apps/CLient-D82pm/src/dusk/providerRun.ts)

### Admin / Creative Ops

Implemented:

- admin shell
- operator model and cloud-readiness/admin guidance docs
- Creative Ops
- skin studio
- audio studio
- scene director
- preview lab
- draft vs published separation
- package summary / publish readiness
- preview compare
- fallback guard for live skin safety
- authored scene states
- response presets
- light presets
- motion presets
- screen packs
- avatar packs
- preview scenario bundles
- expected vs observed scenario capture

Main files:

- [Admin.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Admin.tsx)
- [CreativeOpsPanel.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Admin/CreativeOpsPanel.tsx)
- [creativeOps.ts](/Users/sarynass/dyad-apps/CLient-D82pm/src/admin/creativeOps.ts)
- [PresentationEventsProvider.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/src/presentation/PresentationEventsProvider.tsx)
- [PresentationSceneRuntime.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/src/presentation/PresentationSceneRuntime.tsx)
- [PresentationAudioRuntime.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/src/presentation/PresentationAudioRuntime.tsx)

### Multiplayer

Implemented:

- redesigned mission-control shell
- stronger command-surface design pass
- multiple operational surfaces still present:
  - HQ
  - People
  - Spaces
  - Map
  - Signals
  - Ops

Main file:

- [MultiplayerNew.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/MultiplayerNew.tsx)

### Inventory

Implemented:

- shared catalog alignment with Store
- system assets rack
- improved inner controls and detail actions
- avatar loadout slot binding support

Main files:

- [Inventory.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Inventory.tsx)
- [models.ts](/Users/sarynass/dyad-apps/CLient-D82pm/src/inventory/models.ts)

### Store

Implemented:

- shared catalog source
- theme / widget / module pack alignment with inventory
- improved search/detail controls and command-surface styling

Main files:

- [Store.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Store.tsx)
- [catalog.ts](/Users/sarynass/dyad-apps/CLient-D82pm/src/store/catalog.ts)

### Settings

Implemented:

- canonical settings provider
- station continuity export/import/restore
- platform status
- theme/audio/config controls
- per-mix-group audio runtime controls
- preview cues for authored sound-pack events
- scope-aware station transition notices after keep/import/return decisions
- persistent station identity readout in top shell and settings
- recent station activity / continuity history surfaced in settings
- cleaner shell and inner control pass

Main files:

- [Settings.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Settings.tsx)
- [SettingsProvider.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/src/settings/SettingsProvider.tsx)
- [stationActivity.ts](/Users/sarynass/dyad-apps/CLient-D82pm/src/station/stationActivity.ts)

### Platform / Auth / Onboarding

Implemented:

- local station mode
- account sign-in/sign-up flow
- guest-to-account handoff safeguards
- post-auth account activation notice routing
- shared continuity panel across Welcome and guest connect drawer
- persistent station activity entries for guest/account transition history
- onboarding starter quest loop
- station export / restore
- platform profile sync scaffolding

Main files:

- [Welcome.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Welcome.tsx)
- [StationContinuityPanel.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Auth/StationContinuityPanel.tsx)
- [AuthProvider.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/src/auth/AuthProvider.tsx)
- [FirstRunSetup.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Onboarding/FirstRunSetup.tsx)
- [stationTransitionNotice.ts](/Users/sarynass/dyad-apps/CLient-D82pm/src/auth/stationTransitionNotice.ts)
- [stationActivity.ts](/Users/sarynass/dyad-apps/CLient-D82pm/src/station/stationActivity.ts)

## Current Active Frontier

The current best-developed active frontier is:

- profile scene readability and stage presence
- broad closed-beta account/station coherence
- persistent continuity history and station-state clarity
- Dusk managed planning
- Lab baseline history
- accepted-plan provenance
- user-facing audio runtime coherence for authored sound packs and legacy UI sounds
- post-handoff station-state clarity

That mix of visible Profile-stage work, account/station coherence, Dusk/Lab continuity, and runtime-coherence work is currently the strongest product-value thread under active improvement.

Current stop point:

- the Profile stage is visibly stronger than before:
  - closer hero framing
  - calmer orbit
  - reduced overlay noise
  - softer centered halo instead of the earlier heavier amber column
  - avatar rotated toward the viewer so the subject reads less side-on
- the next best visible-product move is still scene-side silhouette / lighting polish, not another overlay-heavy host pass

- promoted Dusk baselines already preserve accepted plan and compare anchor provenance in Lab
- Dusk already understands baseline compare briefs and planning alignment
- managed sessions now persist baseline compare context
- Lab baseline notes now show provenance and drift
- Settings now exposes master + per-mix-group audio control
- presentation audio and legacy UI sounds now both obey the same device audio state
- guest-mode CONNECT now shows a local station continuity panel before sign-in
- Welcome and the guest connect drawer now both surface:
  - resume workspace
  - starter relay title when present
  - clearer connect-now continuity hints
- Welcome and the guest connect drawer now share the same continuity panel component and wording, so local-station state is described consistently before sign-in
- signed-in guest/account conflicts now open a clearer decision panel showing:
  - account resume workspace
  - guest resume workspace
  - import target workspace
  - explicit keep/import/return consequences
  - carried starter relay / continuity context
- importing a guest station into an account now preserves:
  - guest last workspace
  - guest onboarding state
  - guest starter relay handoff
  - imported workspace restore inside the account scope
- after keep/import/return, the shell now shows a clear station transition notice with:
  - active destination workspace
  - whether cloud state changed
  - whether recovery was saved
  - whether the guest station was kept local
- station transition notices now carry the destination view and expose direct shell actions:
  - open destination workspace
  - review settings
  - dismiss
- station activity now persists safely for both guest and account scope, even when browser storage is partial
- Settings now shows recent continuity/station activity records instead of relying only on ephemeral notices
- guest-mode auth forms now state the continuity guarantee before sign-in:
  - no overwrite without review
  - keep/import/return remains explicit
  - XTATION confirms the active workspace after sign-in
- TopBar and Settings now share one station-identity language for:
  - local station
  - account station
  - imported local station
  - active workspace destination
- Settings > Platform Status now exposes the same guided-setup return affordance as:
  - Welcome
  - the guest `CONNECT` drawer
  - the shell transition banner
- this `Return to Guided Setup` path was verified live in the browser through:
  - `Start Guided Setup`
  - `Skip for now`
  - `Settings`
  - `Return to Guided Setup`
- auth success now writes a small session-scoped transition signal and the app shell converts it into the correct notice only after handoff state is known

## Immediate Next Recommended Move

If a new AI continues from here, the best next move is:

1. keep broader closed-beta readiness stable, but stop deepening continuity micro-fixes unless a real browser journey exposes a mismatch
2. avoid deepening the Dusk/Lab loop again unless it unlocks direct user-facing value
3. the strongest immediate concrete move is to return to visible product work on `Profile`:
   - stronger avatar silhouette
   - stronger stage lighting
   - less overlay competition
   - clearer “main character space” read

This is the current high-confidence next step because the continuity-action surfaces are now mostly aligned and the biggest user-facing win is making the Profile scene unmistakably central.

## Broader Priority After The Immediate Next Step

Once the Dusk/Lab loop is one more layer stronger, the next high-value branches are:

1. closed-beta readiness
   - cloud/operator live path
   - staging/production discipline
   - onboarding polish
   - support flow

2. profile scene maturity
   - stronger authored avatar behavior
   - eventual deeper runtime integration of scene source

3. multiplayer / people ops depth
   - only after the current core flows stay stable

## Local Review Path

Authoritative local review URLs:

- [http://localhost:5176/](http://localhost:5176/)
- [http://127.0.0.1:5176/](http://127.0.0.1:5176/)
- LAN review: [http://192.168.1.3:5176/](http://192.168.1.3:5176/)

Important:

- Prefer local review over old public Vercel preview links.
- Earlier public previews were slim/fallback builds and are not the authoritative runtime.

## Hidden Continuity Risks

These are easy to miss and matter:

### 1. The profile scene now has both runtime and vendored source inside the repo

Important split:

- embedded runtime used by XTATION:
  - [public/avatar-lobby/index.html](/Users/sarynass/dyad-apps/CLient-D82pm/public/avatar-lobby/index.html)
- vendored editable source snapshot:
  - [scene-source/avatar-lobby/demo.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/scene-source/avatar-lobby/demo.tsx)
  - [scene-source/avatar-lobby/halide-topo-hero.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/scene-source/avatar-lobby/halide-topo-hero.tsx)

Legacy origin still exists outside the repo at:

- `/Users/sarynass/Desktop/html`

But continuity should now prefer the in-repo source snapshot first.

### 2. Dusk managed provider is not fully equivalent in plain local Vite dev

Important files:

- [openai.ts](/Users/sarynass/dyad-apps/CLient-D82pm/api/dusk/provider/openai.ts)
- [managedProvider.ts](/Users/sarynass/dyad-apps/CLient-D82pm/src/dusk/managedProvider.ts)

Key behavior:

- in normal local Vite dev, the managed provider route is intentionally blocked unless:
  - XTATION is deployed with the server route available
  - or `VITE_MANAGED_DUSK_PROVIDER_LOCAL=1` is set for local testing

Server-side env vars used by the managed provider bridge:

- `XTATION_DUSK_OPENAI_API_KEY`
- optional:
  - `XTATION_DUSK_OPENAI_MODEL`
  - `XTATION_DUSK_OPENAI_BASE_URL`
  - `XTATION_DUSK_OPENAI_PROJECT`

### 3. Real cloud admin/operator behavior depends on Supabase SQL + JWT hook setup

These files exist and matter:

- [xtation_cloud_stack.sql](/Users/sarynass/dyad-apps/CLient-D82pm/supabase/xtation_cloud_stack.sql)
- [platform_profiles.sql](/Users/sarynass/dyad-apps/CLient-D82pm/supabase/platform_profiles.sql)
- [operator_claim_bootstrap.sql](/Users/sarynass/dyad-apps/CLient-D82pm/supabase/operator_claim_bootstrap.sql)
- [operator_lookup.sql](/Users/sarynass/dyad-apps/CLient-D82pm/supabase/operator_lookup.sql)
- [operator_diagnostics.sql](/Users/sarynass/dyad-apps/CLient-D82pm/supabase/operator_diagnostics.sql)
- [operator_rollout.sql](/Users/sarynass/dyad-apps/CLient-D82pm/supabase/operator_rollout.sql)
- [operator_audit_feed.sql](/Users/sarynass/dyad-apps/CLient-D82pm/supabase/operator_audit_feed.sql)
- [XTATION_OPERATOR_SETUP_V1.md](/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_OPERATOR_SETUP_V1.md)

If those are not applied in Supabase, cloud operator behavior will remain partial or blocked even if the UI exists.

### 4. Use the real project test command

Use:

```bash
npm test
```

Do not assume custom Vitest flags like `--runInBand` are valid here.

## Verification Commands

Use these from the repo root:

```bash
cd /Users/sarynass/dyad-apps/CLient-D82pm
npm run build
npm test
```

Latest verified state at time of writing:

- `npm run build` passed
- `npx vitest run` passed `198/198`

Known low-value warning still present during tests:

- `--localstorage-file` warning from test environment setup

It is noisy but not currently blocking.

## Backup Convention

Backups are stored at:

- `/Users/sarynass/Desktop/html/backups`

Current naming pattern:

- `xtation-source-backup-YYYYMMDD-HHMMSS.zip`

Latest backup at time of writing:

- [xtation-source-backup-20260312-033032.zip](/Users/sarynass/Desktop/html/backups/xtation-source-backup-20260312-033032.zip)

## Fresh AI Bootstrap Notes

If another AI takes over:

- do not start by re-architecting XTATION from scratch
- do not reopen top-level section decisions casually
- do not treat public previews as the source of truth
- do not assume the 3D scene source of truth lives only inside the repo
- do not widen scope until the current active frontier is either finished or intentionally deprioritized

Do this instead:

1. read this file
2. read the spec index
3. verify build/tests
4. inspect the files listed under the current active frontier
5. review locally in browser
6. continue from the immediate next recommended move

## Do Not Lose These Threads

These are easy to forget but important:

- the 3D profile scene is integrated, but its deeper source/runtime evolution still crosses repo boundaries
- Creative Ops is no longer conceptual; it is a real authored publish system
- Dusk managed planning is no longer just chat; it has revision, acceptance, compare, and Lab promotion history
- Lab baselines are now an operating-record system, not only notes
- design consolidation already happened broadly; avoid accidentally reintroducing old rounded utility styling
- the starter relay in Play is now stateful:
  - armed -> start first session/action
  - live -> checkpoint in progress
  - confirmed -> routed workspace action

## Summary

XTATION is no longer in raw brainstorming mode.

It now has:

- locked architecture
- locked spec system
- working local runtime
- coherent top-level client shell
- real admin / creative ops layer
- real Dusk planning workflow
- real Lab baseline history/provenance workflow
- integrated profile scene

The project is still not “finished,” but it is stable enough that a fresh AI can resume cleanly if it follows this continuation map first.
