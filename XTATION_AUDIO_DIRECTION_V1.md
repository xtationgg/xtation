# XTATION Audio Direction V1

## Purpose

This document defines the canonical audio system for Xtation.

It answers:

- how sound should be authored and controlled
- how audio should connect to skins without changing the core engine
- how admin should manage interaction sounds, notifications, ambience, and music
- what users can control versus what only admin can control
- how to keep the system powerful without turning it into a per-button mess

This is the product and system architecture for:

- `Audio Studio`
- `sound cues`
- `mix groups`
- `ambient and music queues`
- `skin-linked audio identity`

## Core Principle

Audio should work the same way as scene direction.

Do not bind random files to random buttons.

The right model is:

```txt
Semantic Event
-> Sound Cue
-> Mix Group
-> Playback Rules
-> Runtime Output
```

This keeps Xtation:

- maintainable
- skinable
- testable
- easy to roll out
- easy to replace later

## Locked Control Rule

Users should not author the audio system.

### Users can control

- master audio on/off
- category volume
- reduced audio mode
- mute ambience
- mute music
- mute Dusk
- comfort/performance behavior

### Admin can control

- what sound cue is linked to each Xtation event
- what sounds belong to each skin
- ambient and music queues
- cue gain, cooldown, priority, and randomization
- versioning and rollout
- upload, replace, preview, publish

This is admin-only creative control.

## Canonical placement

```txt
Admin
- Creative Ops

Creative Ops
- Skin Studio
- Scene Director
- Audio Studio
- Motion Packs
- Avatar Packs
- Preview
- Publish
```

Audio authoring belongs in `Admin > Creative Ops > Audio Studio`.

Normal user `Settings > Audio` should stay simple.

## 1. Audio Studio

Audio Studio should be structured like this:

```txt
Audio Studio
- Event Map
- Sound Library
- Mix Groups
- Ambient
- Music Queues
- Dusk / Voice
- Preview
- Publish
```

### Event Map

This is the main control table.

Each row is a semantic Xtation event.

Examples:

- `ui.nav.select`
- `ui.drawer.open`
- `ui.drawer.close`
- `ui.button.confirm`
- `ui.button.cancel`
- `ui.tab.switch`
- `notification.low`
- `notification.urgent`
- `quest.started`
- `quest.completed`
- `session.started`
- `session.completed`
- `profile.deck.open`
- `dusk.open`
- `dusk.reply`

Each row should show:

- sound icon
- current assigned cue
- preview button
- upload / replace button
- active skin override indicator
- mix group
- cooldown
- priority

This matches what you asked for, but in a maintainable way.

### Sound Library

This is the asset inventory for audio.

Each sound asset should show:

- name
- waveform preview
- duration
- format
- gain
- normalized status
- loopable or one-shot
- tags
- source / license info
- where it is used

### Mix Groups

These are required.

Without mix groups, the audio system will become chaos.

Recommended groups:

- `ui`
- `notifications`
- `quest`
- `dusk`
- `ambient`
- `music`
- `scene_fx`

Each group should support:

- gain
- mute
- ducking policy
- limiter behavior later

### Ambient

Ambient should not be handled like one-shot UI sounds.

Ambient system should support:

- profile idle ambient
- day ambient
- night ambient
- focus ambient
- local/offline ambient
- skin-specific environment beds

### Music Queues

Music should be optional, structured, and stoppable.

Recommended queues:

- profile lobby queue
- play / focus queue
- reward queue
- skin-linked queue

### Dusk / Voice

This lane should control:

- Dusk open tone
- Dusk action tones
- Dusk success / blocked / failure tones
- optional future voice packs
- ducking when Dusk is active

## 2. Semantic event model

Do not bind sounds directly to raw button ids.

Wrong:

- `#status-button -> ping_17.wav`

Right:

- `profile.status.open -> cue_status_ping`

Why:

- UI can change later
- the same event may be triggered from multiple surfaces
- sound logic stays connected to product meaning
- skins can override behavior cleanly

## 3. Cue model

```txt
SoundCue
- id
- name
- eventName
- assetIds[]
- playbackMode
- mixGroup
- volume
- cooldownMs
- priority
- conditions
- pitchRange?
- stereoMode?
- createdAt
- updatedAt
```

### Playback modes

Recommended:

- `single`
- `random_variant`
- `round_robin`
- `layered`
- `loop`

### Conditions

Examples:

- only when active skin is `ops`
- only during profile section
- only at night
- only when local station is active
- only if reduced audio is off

### Priority

Recommended scale:

- `ambient`
- `standard`
- `important`
- `critical`

Priority is needed so urgent alerts can override low-level UI noise.

## 4. Skin-linked sound identity

Skins should define their own audio identity.

A skin can change:

- UI click character
- notification style
- profile ambient
- reward cues
- Dusk shell tones
- scene FX tones

But it must not change:

- engine logic
- action semantics
- permissions
- billing

### Canonical sound pack model

```txt
SoundPack
- id
- name
- skinId
- cueMappings
- ambientSet
- musicQueue
- voiceSet?
- version
- releaseChannel
```

## 5. Ambient and music behavior

This needs stricter rules than normal UI sounds.

### Ambient rules

- should loop smoothly
- should crossfade
- should obey reduced audio mode
- should duck under voice/critical alerts
- should have quiet night variants

### Music rules

- should always be optional
- should never block core UX
- should pause or duck during important actions
- should be disableable by users

## 6. User-facing audio controls

User `Settings > Audio` should stay simple:

```txt
Audio
- Master Volume
- UI Volume
- Notifications Volume
- Ambient Volume
- Music Volume
- Dusk Volume
- Mute All
- Reduced Audio
- Ambient Off
- Music Off
```

No raw cue editing.
No sound mapping table.
No admin-level controls.

## 7. Admin-only controls

Admin `Audio Studio` should support:

- upload
- replace
- remove
- preview
- version history
- usage map
- cue mapping
- mix group routing
- skin override
- rollout
- rollback

## 8. Upload and asset pipeline

This is one of the most important parts people forget.

### Required asset pipeline features

- waveform preview
- duration extraction
- loudness normalization
- supported format validation
- loop metadata
- source/license note
- size limits
- fallback conversion if needed

### Strong recommendation

Do not trust uploaded raw files as-is.

Assets should be normalized into a known playback-safe shape before publishing.

## 9. Recommended runtime stack

The best-known practical stack for Xtation is:

```txt
Playback layer
- Howler.js

Low-level graph control, ducking, analysis
- Web Audio API

Music scheduling only if needed later
- Tone.js
```

### Why Howler.js

Howler is the best fit for cross-platform web/desktop playback because it already handles modern browser playback well and exposes useful control points like preload, fade, rate, unload, sprites, and spatial/stereo support.

Sources:

- [Howler.js](https://howlerjs.com/)

### Why Web Audio API

You still need direct graph-level control for:

- ducking
- mix group routing
- analysis
- filters
- future advanced audio behavior

Sources:

- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Web Audio API best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)

### Why Tone.js only later

Tone is strongest when you need transport-level timing and music scheduling.
It is not necessary for the whole UI sound system.

Source:

- [Tone.js](https://tonejs.github.io/)

## 10. Audio rules that must be built in

These are non-negotiable:

### 1. Cooldowns

Rapid repeated clicks should not machine-gun the same sound.

### 2. Random variants

High-frequency interactions should support subtle variation.

### 3. Ducking

Critical alerts, Dusk voice, or priority cues should reduce ambient/music temporarily.

### 4. Fallbacks

If a skin sound pack fails or is missing, Xtation should fall back to the base pack.

### 5. Loudness consistency

Mixed loudness will make the product feel broken.

### 6. Performance safety

No huge library preloads by default.
Only preload high-probability assets and active packs.

### 7. Offline support

Base packs must work offline.

### 8. Accessibility

Reduced audio mode should exist from day one.

## 11. Best first version

### V1 should support

- semantic event taxonomy
- sound asset library
- upload / replace / preview
- cue mapping table
- mix groups
- skin-linked overrides
- ambient sets
- optional music queues
- preview simulator
- publish and rollback

### V1 should not support

- arbitrary audio scripting
- per-DOM-button binding
- fully procedural music generation
- user-authored sound systems

## 12. Extra systems you did not explicitly ask for but should exist

These are important:

### Haptics map later

Use the same semantic event taxonomy for vibration/haptic support on future mobile builds.

### Usage map

Before replacing a sound, Admin should see every place that cue is used.

### Safety meter

Warn when a pack is too loud, too dense, or too repetitive.

### A/B rollout

Try new sound packs on internal or beta cohorts first.

### Audit log

Every published audio change should be attributable and reversible.

## 13. Example flow

```txt
Admin opens Audio Studio
-> selects event `profile.status.open`
-> uploads three short amber variants
-> maps cue to mix group `ui`
-> sets playback mode `random_variant`
-> sets cooldown `180ms`
-> links override to skin `bureau-amber`
-> previews in profile lobby
-> publishes to beta

User activates Bureau skin
-> opens profile status
-> Xtation emits `profile.status.open`
-> runtime resolves current skin cue
-> selected variant plays
-> engine logic remains unchanged
```

## 14. Final summary

```txt
Audio is a directed system, not loose files
Semantic events map to sound cues
Admins author and publish audio packs
Users only control comfort and volume
Skins can radically change the feel
Xtation logic stays unchanged
```

This is the right way to give you full control without making the system collapse under its own complexity.
