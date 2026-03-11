# XTATION Avatar and Scene V1

## Purpose

This document defines the user avatar system and its relationship to the 3D scene runtime in Xtation.

It answers:

- what the user avatar is
- how the avatar differs from Dusk
- where the avatar appears
- how the scene runtime should be integrated
- how avatar scenes should stay useful instead of decorative
- how Xtation should scale from web to desktop to future mobile without making 3D mandatory

This is the canonical product and system architecture for the Xtation avatar layer.

## Core Separation Rule

Xtation must keep these systems separate:

```txt
User Avatar
- the user’s human representation
- identity and embodiment layer

Dusk
- assistant character
- command and intelligence layer

Scene Runtime
- rendering and animation engine
- visual stage only
```

They can interact.
They must not be merged into one object.

## Core Definition

The Xtation avatar is the user’s embodied presence inside the product.

The avatar should represent:

- the player
- the body
- the current mode
- loadout and environment
- progress, attention, and readiness signals

The avatar should not represent:

- the assistant
- the database
- the quest engine truth
- the only way to use the app

## Product Role

The avatar system should make Xtation feel:

- personal
- alive
- embodied
- motivating
- spatially understandable

The avatar should turn abstract progress into a visible lived space.

## Where the Avatar Belongs

### 1. Profile

Profile is the main home of the avatar.

Best mental model:

- `Profile = avatar lobby`

The profile lobby can show:

- idle avatar scene
- incoming quest signals
- current mode or environment
- recent milestone ambience
- loadout or cosmetic state

### 2. Play

Play is the second major surface for the avatar.

The avatar can support:

- guided exercise playback
- breathing or posture guidance
- active quest stance/mood changes
- focus-session ambience

In Play, the avatar should help execution, not distract from it.

### 3. Inventory

Inventory should connect to the avatar through:

- outfit or accessory slots later
- equipment visibility
- environment props
- resource-to-avatar links

### 4. Store

Store can sell or grant:

- avatar style packs
- environment packs
- animation packs
- idle packs
- scene cosmetics

### 5. Settings

Settings must control:

- scene enabled/disabled
- scene quality
- effects density
- motion reduction
- audio rules
- performance mode

## Avatar Use Cases

The best avatar features are practical and legible.

### Profile Lobby Signals

Examples:

- quest markers moving toward the avatar to represent upcoming obligations
- ambient color changes based on active mode
- scene lighting changes by time of day
- milestone glow or environment shift after major progress

### Exercise Guidance

Examples:

- push-up demo
- squat loop
- stretch cycle
- breathing sequence

Rule:

The avatar should support physically-followable actions only when the motion is clear and reliable.

### Presence and Progress

Examples:

- rested/active/focus state
- highlighted self-tree domain
- current campaign or project atmosphere
- reward scene changes after session completion

## What the Avatar Should Not Become

Do not make the avatar:

- mandatory for basic use
- the source of truth for state
- a giant game lobby detached from actual work
- a high-latency wrapper around every action
- a performance burden on low-end devices

The avatar must remain helpful even when disabled, simplified, or absent.

## Canonical System Layers

The avatar system should be built as these layers:

```txt
Avatar System
- Avatar Domain Layer
- Avatar Intent Layer
- Scene Adapter Layer
- Scene Runtime Layer
- Presentation Packs
- Performance and Accessibility Layer
```

## 1. Avatar Domain Layer

This layer defines the user-facing avatar data.

Recommended conceptual objects:

```txt
AvatarProfile
- id
- userId
- bodyModelKey
- stylePackKey?
- motionPackKey?
- loadoutPresetKey?
- expressionMode
- createdAt
- updatedAt

AvatarLoadout
- id
- userId
- slots
- linkedInventoryItemIds[]
- createdAt
- updatedAt

AvatarScenePreference
- id
- userId
- profileEnvironmentPackKey?
- playEnvironmentPackKey?
- sceneQualityMode
- effectsLevel
- audioLevel
- updatedAt

AvatarSignalState
- userId
- activeQuestCount
- activeMode
- incomingQuestMarkers[]
- focusState
- highlightedSelfTreeBranch?
- recentRewardState?
- updatedAt

ExerciseActionPack
- id
- key
- label
- supportedActions[]
- createdAt
```

## 2. Avatar Intent Layer

The main app should not talk to scene internals directly.

It should express high-level avatar intents such as:

```txt
Avatar Intents
- avatar.lobby.enter
- avatar.mode.set
- avatar.signals.update
- avatar.loadout.apply
- avatar.exercise.start
- avatar.exercise.stop
- avatar.reward.play
- avatar.environment.set
```

This is the correct level of control for Xtation.

## 3. Scene Adapter Layer

The scene adapter translates Xtation avatar intents into scene bridge commands.

This follows the same architecture already proven by the 3D prototype:

- host owns intent
- scene owns rendering
- bridge owns the contract

The provided lobby docs already lock the right direction:

- the scene package is a reusable runtime
- the host app should integrate through the bridge
- safe/full deployment mode is a runtime capability concern

That architecture should be preserved.

## 4. Scene Runtime Layer

The scene runtime owns:

- model loading
- animation playback
- camera
- lights
- effects
- environment
- scene events

The scene runtime does not own:

- auth
- quest truth
- profile truth
- store/catalog truth
- permissions

## 5. Presentation Packs

Avatar presentation should consume the shared Xtation theme and skin system.

It should use:

- environment packs
- avatar style packs
- motion packs
- sound packs

The avatar scene should not invent a separate visual language.

## 6. Performance and Accessibility Layer

The avatar system must degrade gracefully.

Recommended quality levels:

```txt
Avatar Scene Quality
- Off
- Lite
- Standard
- Full
```

### Off

- no live 3D scene
- fallback to image or static profile card

### Lite

- simplified environment
- reduced effects
- limited motion
- lower-resolution assets

### Standard

- normal recommended experience

### Full

- strongest desktop-quality presentation

## Canonical Avatar Modes

The avatar should support a small set of clear runtime modes.

Recommended V1:

- `idle`
- `focus`
- `reward`
- `exercise`
- `rest`

These are enough for the first system.

More should be added only if they create real value.

## Guided Exercise Direction

Exercise is one of the best practical uses of the avatar system.

Recommended rule:

- exercise actions are specialized `Play` helpers
- they should be attached to quest type or quest metadata
- the avatar should only perform motions that are reliable and legible

Examples:

- push-up quest -> show push-up loop
- stretching quest -> show stretch loop
- breathing quest -> show breathing rhythm

Do not overpromise full trainer-grade biomechanics until the action library is strong.

## Profile Lobby Direction

The profile lobby should not be a random showcase scene.

It should communicate useful state.

Recommended profile-lobby signals:

- active mode lighting
- time-based ambience
- incoming quest markers
- current self-tree emphasis
- recent reward afterglow
- optional environment linked to active skin

This is the best way to make the 3D scene meaningful.

## Multiplayer Direction Later

Multiplayer should not default to heavy shared 3D scenes.

Later multiplayer usage can include:

- presence cards
- room avatars
- shared focus-room scenes

But the first purpose of the avatar system is personal presence, not multiplayer spectacle.

## Mobile Direction

Future mobile should not aim for full 3D parity first.

Recommended mobile strategy:

- static or low-cost avatar preview
- simple status representation
- quick exercise guidance only when proven useful

Desktop and web can carry the richer scene workload first.

## Scene Packaging Rule

The 3D scene should remain a portable module.

The offline bundle you already built proves the right packaging direction:

- portable exported package
- clear bridge contract
- local/offline runnable
- host-driven orchestration

This should remain the integration model.

## Asset Budget Rule

The current anatomy prototype asset is too heavy for default web use.

V1 should avoid shipping a heavy base model by default.

Recommended direction:

- one optimized base avatar first
- compressed geometry and textures
- progressive quality tiers
- richer packs later

Strong implementation references:

- `GLTFLoader`, `DRACOLoader`, and `KTX2Loader` are the right three.js runtime building blocks for compressed assets: [GLTFLoader](https://threejs.org/docs/examples/en/loaders/GLTFLoader.html), [DRACOLoader](https://threejs.org/docs/examples/en/loaders/DRACOLoader.html), [KTX2Loader](https://threejs.org/docs/examples/en/loaders/KTX2Loader.html)
- `gltf-transform optimize` is a strong offline pipeline tool for pruning, simplifying, texture compression workflows, and preparing delivery-friendly GLB assets: [glTF Transform CLI](https://gltf-transform.dev/cli.html)

## Canonical Avatar Rules

These rules should remain locked:

1. The avatar is the user, not Dusk.
2. The scene runtime is not the source of truth for app data.
3. 3D is optional and must have graceful fallback.
4. Profile is the primary avatar home.
5. Play is the main functional avatar surface.
6. Avatar signals should reflect useful system state, not random decoration.
7. Skins change presentation, not engine behavior.

## Recommended Build Order

### Phase 1: Avatar Lobby Foundation

- one optimized base avatar
- one profile lobby environment
- one avatar intent adapter
- active mode and time-of-day scene changes
- simple incoming quest markers

### Phase 2: Play Integration

- guided exercise actions
- focus and reward scene changes
- play-linked environment switching

### Phase 3: Loadout and Store

- avatar style packs
- environment packs
- loadout slots
- scene cosmetics

### Phase 4: Richer Identity

- more avatar customization
- more animation packs
- more expressive environments

## Current Repo Alignment

Current repo has:

- a broad app shell
- settings foundations
- store concept
- Dusk direction
- Electron and Capacitor shells

Current repo does not yet have:

- integrated avatar domain objects
- a canonical avatar adapter
- a scene module checked into the main repo
- performance-aware avatar quality settings wired into the app

The lobby prototype exists outside the main repo as a separate scene project and should stay conceptually modular.

## Final Lock

The correct Xtation avatar architecture is:

- one user avatar system
- separate from Dusk
- powered through a scene runtime bridge
- useful in Profile and Play first
- optional, optimized, and scalable

Xtation should feel embodied.
It should not become dependent on 3D for basic usefulness.
