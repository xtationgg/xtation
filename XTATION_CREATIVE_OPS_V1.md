# XTATION Creative Ops V1

## Purpose

This document defines the admin-only creative control system for Xtation.

It answers:

- how skins should change the experience without changing the engine
- how scene reactions should be authored and linked to Xtation interactions
- where timeline authoring should live
- what users can control versus what admins can control
- how camera, light, FX, audio, and avatar behavior should be published safely

This is the canonical architecture for:

- `Creative Ops`
- `Skin Runtime`
- `Scene Director`
- `trigger -> cue -> playback`

## Core Principle

Xtation must separate:

```txt
Core Logic
- quests
- sessions
- XP
- profile data
- lab systems
- multiplayer state

Presentation Runtime
- theme
- skin
- scene behavior
- camera
- lighting
- FX
- sound
- avatar look
- Dusk shell look

Admin Authoring
- skin creation
- cue binding
- timeline design
- preview
- publish
```

The engine must stay stable.
The presentation layer can become radically different.

This is the same principle as game skins:

- same abilities
- same system rules
- different expression

## Locked Control Rule

Users should not author scene reactions directly.

Users can:

- choose a published skin
- choose comfort/performance settings
- enable or mute motion/audio
- use the published experience

Admins can:

- define skins
- define scene cues
- bind cues to semantic Xtation events
- preview and publish cue packs
- stage or roll out skins to cohorts

This is an admin-only creative system.

## Canonical System Structure

```txt
Admin
- Overview
- Users
- Rollout
- Catalog
- Support
- Audit
- Creative Ops

Creative Ops
- Skin Studio
- Scene Director
- Motion Packs
- Sound Packs
- Avatar Packs
- Preview and Publish
```

This should live inside `Admin`, not in normal user settings and not in the public store UI.

## 1. Skin Runtime

A skin is not just colors.
A skin is the published presentation bundle that changes how Xtation feels.

### A skin can change

- semantic theme tokens
- UI motion style
- UI transition timing
- audio style
- Dusk presentation
- avatar presentation
- scene environment
- scene cue mappings
- map/environment styling later

### A skin must not change

- quest logic
- XP logic
- permissions
- feature semantics
- automation engine rules
- billing
- account behavior

### Canonical skin shape

```txt
SkinPack
- id
- name
- status
- themeId
- motionPackId
- soundPackId
- scenePackId
- avatarPackId
- duskPackId
- targetSections[]
- releaseChannel
- version
- createdAt
- updatedAt
```

## 2. Scene Director

The scene should not react through random imperative mutations.

It should react through authored cues.

The right model is:

```txt
Trigger
-> Cue
-> Timeline
-> Playback
```

### Trigger

A semantic Xtation event.

Examples:

- `profile.deck.open`
- `profile.status.open`
- `profile.tab.switch`
- `play.session.start`
- `play.session.complete`
- `quest.completed`
- `quest.incoming`
- `dusk.brief.loaded`
- `ambient.day.enter`
- `ambient.night.enter`
- `station.mode.focus`

### Cue

A named scene response authored by admin.

Examples:

- `cue_profile_deck_open`
- `cue_status_panel_reveal`
- `cue_quest_complete_burst`
- `cue_night_ambient_shift`
- `cue_focus_mode_lockin`

### Timeline

The actual authored motion sequence for:

- camera
- lights
- FX
- avatar pose/animation
- scene screens
- audio

### Playback

Runtime execution of the cue with priority and interruption rules.

## 3. Why semantic events matter

Do not bind cues directly to raw buttons.

Wrong:

- button id `status-btn` -> move camera to x/y/z

Right:

- UI action emits `profile.status.open`
- active skin resolves that event to cue `cue_status_panel_reveal`
- runtime plays the published cue

Why:

- UI can change without breaking scene authoring
- multiple UI paths can trigger the same scene behavior
- skins stay maintainable
- admin works at the product-meaning level, not DOM implementation level

## 4. Cue Model

```txt
InteractionCue
- id
- name
- description
- trigger
- conditions
- timelineId
- priority
- interruptPolicy
- cooldownMs
- sectionScope[]
- createdAt
- updatedAt
```

### Conditions

Examples:

- only when active skin is `ops`
- only when profile scene is visible
- only in local mode
- only at night
- only when focus mode is active

### Priority

This is how playback conflicts are resolved.

Recommended priorities:

- `ambient`
- `ui`
- `quest`
- `critical`
- `blocking`

### Interrupt policy

Recommended values:

- `ignore_if_playing`
- `restart`
- `queue`
- `blend`
- `block_lower_priority`

## 5. Timeline Model

The timeline should be authored as tracks, not one unstructured blob.

```txt
CueTimeline
- id
- name
- durationMs
- tracks[]

Track types
- camera
- lighting
- fx
- avatar
- screen
- audio
```

### Camera track

Can animate:

- shot preset
- transform
- FOV
- focus depth
- ease

### Lighting track

Can animate:

- key/fill/rim intensity
- tint
- environment mode
- fog/atmosphere
- pulse and fades

### FX track

Can animate:

- overlays
- particle bursts
- sweeps
- distortion pulses
- vignette/scanline/noise intensity

### Avatar track

Can animate:

- idle set
- pose
- animation state
- head turn
- breathing intensity
- emphasis marker

### Screen track

Can animate:

- in-scene screen labels
- status display
- panel reveal
- cue text

### Audio track

Can animate:

- sting trigger
- ambience layer
- low-pass/high-pass transitions
- gain changes

## 6. Ambient State System

Not every scene change should come from a discrete interaction.

Some changes should be ambient and persistent.

```txt
AmbientStateProfile
- id
- name
- conditions
- environmentMode
- lightPreset
- cameraIdlePreset
- fxPreset
- audioPreset
```

Examples:

- `day_idle`
- `night_idle`
- `focus_active`
- `connected_station`
- `offline_station`

These should blend with event cues, not fight them.

## 7. Admin Authoring Surface

The creative authoring system should feel closer to motion-design tooling than normal settings.

### Recommended Creative Ops structure

```txt
Creative Ops
- Skin Studio
- Scene Director
- Motion Packs
- Sound Packs
- Avatar Packs
- Preview
- Publish
```

### Skin Studio

Owns:

- theme link
- active packs
- cue map
- target sections
- release status

### Scene Director

Owns:

- triggers
- cues
- timelines
- camera presets
- light presets
- FX presets
- preview transport

### Preview

Must support:

- preview in current scene
- preview against synthetic Xtation events
- preview against a chosen skin
- preview interruption behavior

### Publish

Must support:

- draft
- internal
- beta
- stable
- rollback to previous version

## 8. Admin-only versus user-visible controls

### User-visible

In `Settings` users should only see:

- active skin
- motion intensity
- audio enabled
- scene quality
- scene enabled/disabled

### Admin-only

In `Creative Ops` admins should see:

- track editor
- trigger binding table
- priority rules
- camera preset library
- light preset library
- cue preview tools
- publish/version controls

This keeps the product understandable for normal users.

## 9. Recommended implementation stack

The best-known technical split is:

```txt
Timeline authoring
- Theatre.js

State and conflict control
- XState

Low-level helper animation
- GSAP only where needed
```

### Why Theatre.js

Theatre.js is the best fit for authored scene timelines because it is built for web animation authoring and has official Three.js integration.

Sources:

- [Theatre.js](https://www.theatrejs.com/)
- [Theatre.js with THREE.js](https://www.theatrejs.com/docs/0.5/getting-started/with-three-js)

### Why XState

Scene cues will conflict.
You need deterministic state, transitions, priorities, and interruption handling.
That is what state machines are for.

Source:

- [XState docs](https://stately.ai/docs/xstate)

### Why not GSAP as the main authoring layer

GSAP timelines are excellent for runtime sequencing, but they are not the best primary authoring model for a creative admin tool with publishable timeline assets.

Source:

- [GSAP Timeline docs](https://gsap.com/docs/v3/GSAP/Timeline/)

### Why not Rive as the main 3D authoring system

Rive is strong for 2D interactive/state-machine assets, but it is not the best primary fit for the 3D avatar lobby and camera/light authoring system.

Source:

- [Rive state machine playback](https://rive.app/docs/runtimes/state-machines)

Rive may still be useful later for:

- Dusk expression shells
- micro-interactive assistant panels
- 2D HUD overlays

## 10. Runtime playback contract

The user runtime should not interpret arbitrary admin code.

It should only consume published cue data.

```txt
Published Cue Runtime
- event comes in
- director resolves matching cue
- state machine checks priority and conditions
- cue timeline plays through the scene adapter
- audit event recorded
```

This is safer and easier to debug than arbitrary scripting.

## 11. Audit and rollout

Because this is admin-authored and highly visible, it needs operator discipline.

Every published creative change should record:

- actor
- skin id
- cue id
- version
- release channel
- target cohort
- timestamp

This belongs in Admin audit history.

## 12. Best first version

Do not start with a full freeform cinematic suite.

### V1 should support

- semantic trigger list
- skin pack definition
- cue library
- limited track types
- camera preset library
- light preset library
- preview in profile lobby
- publish to draft/internal/beta/stable

### V1 should not support

- arbitrary scripting
- every UI control mapped directly to scene values
- full node-graph compositing
- user-authored cues
- uncontrolled per-button animation editing

## 13. Example flow

```txt
Admin chooses Skin: Ops
-> binds event `profile.status.open`
-> to cue `cue_status_panel_reveal`
-> cue uses camera preset `status-close`
-> light preset `amber-scan`
-> FX preset `panel-sweep`
-> audio preset `status-ping`
-> publishes skin version

User activates Ops skin
-> user opens status panel
-> XTATION emits `profile.status.open`
-> Scene Director resolves and plays cue
-> engine logic stays unchanged
```

## 14. Final system summary

```txt
Core engine stays fixed
Users select published skins
Admins author scene behavior
Skins map semantic events to cues
Cues play authored timelines
State machine resolves conflict and priority
Scene runtime only consumes published data
```

This is the right way to make Xtation feel radically different by skin while keeping the product stable.
