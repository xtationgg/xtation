# XTATION Creative Ops Screens V1

## Purpose

This document defines the exact admin-facing screens for `Creative Ops`.

It answers:

- what screens should exist
- what each screen owns
- how scene, sound, motion, avatar, and skin authoring should be separated
- how preview and publish should work

This is the UI/IA contract for the admin-only creative system.

## Core Principle

Creative Ops should feel like a controlled studio, not a cluttered settings page.

It should support:

- authoring
- preview
- versioning
- publishing
- rollback

It should not expose all low-level controls everywhere at once.

## Top-Level Structure

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
- Overview
- Skin Studio
- Scene Director
- Audio Studio
- Motion Packs
- Avatar Packs
- Preview Lab
- Publish Log
```

## 1. Creative Ops Overview

Purpose:

- show the currently active creative system state

Should show:

- active skin catalog count
- draft versus published packs
- recent scene cue publishes
- recent audio publishes
- skin rollout targets
- fallback/default pack state

This should be the control room summary, not the editing surface.

## 2. Skin Studio

Purpose:

- define and assemble the user-facing skin package

Should support:

- skin name
- status
- target section scope
- linked theme
- linked sound pack
- linked scene pack
- linked motion pack
- linked avatar pack
- linked Dusk style pack later
- release channel
- version notes

Recommended layout:

```txt
Skin Studio
- Skin List
- Skin Detail
- Pack Wiring
- Section Preview
- Version History
```

### Skin List

Should show:

- name
- status
- release channel
- updated time
- linked packs summary

### Skin Detail

Should show:

- metadata
- target sections
- fallback behavior
- active overrides

### Pack Wiring

Should show:

- theme pack selector
- sound pack selector
- scene pack selector
- motion pack selector
- avatar pack selector

## 3. Scene Director

Purpose:

- author scene behavior from semantic triggers to authored cues

Recommended layout:

```txt
Scene Director
- Trigger Map
- Cue Library
- Timeline Editor
- Preset Libraries
- Preview
```

### Trigger Map

Rows should show:

- event name
- assigned cue
- active skin override
- conditions
- priority
- cooldown
- preview button

### Cue Library

Should show:

- cue name
- trigger families
- duration
- track count
- last edited
- published version

### Timeline Editor

Should support tracks for:

- camera
- lighting
- FX
- avatar
- screen
- audio

### Preset Libraries

Separate preset tabs:

- camera presets
- light presets
- FX presets
- ambient state presets

## 4. Audio Studio

Purpose:

- author the full sound system

Recommended layout:

```txt
Audio Studio
- Event Map
- Sound Library
- Mix Groups
- Ambient
- Music Queues
- Dusk / Voice
- Preview
```

### Event Map

Each row should show:

- sound icon
- event name
- cue name
- active skin override
- upload button
- replace button
- preview button
- mix group
- cooldown

This is the screen you were describing.

### Sound Library

Should show:

- waveform
- duration
- tags
- normalization status
- loop status
- source/license
- usage map

### Mix Groups

Should support:

- gain
- mute
- ducking
- category routing

### Ambient / Music / Dusk

These should be separate because they follow different rules from UI clicks.

## 5. Motion Packs

Purpose:

- define non-scene UI motion behavior for skins

Should support:

- panel transitions
- modal transitions
- tab switching
- hover intensity
- notification motion
- motion density

This keeps UI motion separate from 3D scene motion.

## 6. Avatar Packs

Purpose:

- define avatar style, loadout defaults, and animation sets

Should support:

- avatar style pack
- idle set
- pose set
- linked outfit/loadout defaults
- reward pose later
- exercise pack mapping later

This should not directly edit user save data.

It should publish reusable packs.

## 7. Preview Lab

Purpose:

- simulate user interactions before publishing

Should support:

- choose skin
- choose section
- fire semantic events
- run day/night ambient previews
- test interrupt rules
- preview audio + scene together
- preview reduced motion / reduced audio fallbacks

This is critical.

Without Preview Lab, Creative Ops will become blind trial-and-error.

## 8. Publish Log

Purpose:

- track creative changes safely

Should show:

- published pack
- actor
- version
- release channel
- timestamp
- rollback button
- notes

This should connect to Admin audit.

## 9. Exact editing flow

Recommended flow:

```txt
Open Creative Ops
-> choose or create skin
-> attach theme/sound/scene/motion/avatar packs
-> bind semantic events
-> preview in Preview Lab
-> publish to draft/internal/beta/stable
-> inspect in Publish Log
```

## 10. What should stay out of Creative Ops

Do not put these here:

- billing
- direct user profile editing
- raw quest data editing
- support impersonation
- deployment environment controls

Creative Ops is for experience authoring only.

## 11. Best first implementation order

1. `Skin Studio`
2. `Scene Director Trigger Map`
3. `Audio Studio Event Map`
4. `Preview Lab`
5. `Publish Log`
6. deeper timeline editors

This is the right order because it gets the architecture working before the heavyweight editors.
