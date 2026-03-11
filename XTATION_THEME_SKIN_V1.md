# XTATION Theme and Skin V1

## Purpose

This document defines the canonical presentation system for Xtation.

It answers:

- what a theme is
- what a skin is
- how Store, Settings, Dusk, Avatar, and Scene should connect
- how presentation can change without breaking the core system
- how Xtation should stay visually rich without becoming visually chaotic

This is not only a color-mode spec.
It is the full presentation contract for Xtation.

## Core Principle

Xtation should have one stable engine and many presentation layers.

The best mental model is:

```txt
Engine
- same rules
- same objects
- same interactions

Presentation
- different look
- different motion
- different sound
- different atmosphere
- different scene treatment
```

This is the same basic principle as character skins in games:

- the system stays stable
- the expression changes

## Canonical Terms

### Theme

A theme is the semantic visual system of Xtation.

It controls:

- color tokens
- typography tokens
- spacing and shape tokens
- elevation and surface treatment
- motion defaults
- sound defaults

Themes are foundational.

### Skin

A skin is a branded experiential layer that sits on top of the theme system.

It controls:

- visual flavor
- scene/environment styling
- audio flavor
- Dusk presentation
- avatar presentation
- map/lobby atmosphere later

Skins are experiential.

### Mode

A mode is a runtime state that changes emphasis inside the active theme or skin.

Examples:

- focus mode
- play mode
- rest mode
- night mode
- low-distraction mode

Modes are contextual, not owned catalog items by default.

## Locked Presentation Stack

Xtation presentation should be built in this order:

```txt
Presentation Stack
- Foundation Tokens
- Semantic Theme
- Section Overrides
- Skin Pack
- Runtime Mode Adjustments
- User Accessibility / Performance Overrides
```

This order should remain stable.

## 1. Foundation Tokens

Foundation tokens are the raw reusable values.

Examples:

- color ramps
- font families
- font sizes
- radii
- spacing units
- shadow strengths
- motion durations
- sound intensity values

These are not user-facing settings.
They are implementation primitives.

## 2. Semantic Theme

Xtation should use semantic tokens instead of hardcoded raw colors in components.

Examples:

- `surface.base`
- `surface.panel`
- `surface.elevated`
- `text.primary`
- `text.muted`
- `accent.primary`
- `accent.warning`
- `line.subtle`
- `motion.standard.duration`
- `sound.confirmation.gain`

This is how Xtation keeps design consistent while still supporting different skins.

## 3. Section Overrides

Each major section can have a controlled presentation bias without becoming its own app.

Examples:

- `Play` can be more focused and immersive
- `Profile` can be more reflective and atmospheric
- `Lab` can be more structured and precise
- `Multiplayer` can be more strategic and operational
- `Inventory` can be more archival and tactile

Section overrides must stay semantic.
They should not redefine random component styles ad hoc.

## 4. Skin Packs

Skin packs are the main sellable and expressive presentation units.

Skin packs can change:

- accent families
- surface treatment
- scene atmosphere
- lobby environment packs
- icon style
- motion character
- UI chrome details
- Dusk presentation
- avatar presentation defaults
- optional sound pack

Skin packs must not change:

- information architecture
- XP math
- permissions
- billing logic
- automation semantics
- admin safeguards

Skins are expression, not engine mutation.

## 5. Runtime Mode Adjustments

Modes should be smaller than skins and faster to switch.

They should be used for state changes like:

- focus session started
- low-battery laptop mode
- night usage
- exercise quest active
- guided Dusk conversation

Modes can adjust:

- brightness
- saturation
- motion density
- sound behavior
- panel intensity
- scene ambience
- notification strength

Modes should never make the UI unpredictable.

## 6. Accessibility and Performance Overrides

User comfort always overrides skin style.

These controls belong in Settings and must win over presentation packs:

- reduced motion
- low effects
- mute or reduced sound
- high contrast later
- low-end 3D mode
- scene disabled mode
- compact density

If a skin conflicts with comfort or performance settings, the comfort/performance rule wins.

## Canonical Package Types

Xtation should treat presentation as modular packages.

```txt
Presentation Packages
- Theme Pack
- Skin Pack
- Motion Pack
- Sound Pack
- Environment Pack
- Avatar Style Pack
- Dusk Style Pack
- Map Style Pack later
```

These packages can be free, bundled, earned, or sold.

## Recommended Store Structure

Store should operate presentation content through modular catalog items:

```txt
Store Catalog
- Themes
- Skins
- Motion Packs
- Sound Packs
- Play Environments
- Profile Lobby Environments
- Avatar Style Packs
- Dusk Style Packs
- Lab Workspace Packs
- Template Bundles
```

This is cleaner than one flat catalog.

## Recommended Settings Structure

Settings should activate and manage the user’s presentation system.

```txt
Settings > Interface
- Active Theme
- Active Skin
- Density
- Motion Level
- Sound Level
- Scene Quality
- Low Effects
- Reduce Animation
- Reduce Atmosphere
```

Settings should not expose every raw token.
The user should choose understandable packs and comfort levels.

## Canonical Presentation Objects

Recommended conceptual objects:

```txt
ThemePack
- id
- key
- label
- description
- tokenSet
- sectionOverrides
- createdAt
- updatedAt

SkinPack
- id
- key
- label
- description
- baseThemeKey
- visualPack
- motionPackKey?
- soundPackKey?
- environmentPackKey?
- duskStyleKey?
- avatarStyleKey?
- entitlementKey?
- createdAt
- updatedAt

MotionPack
- id
- key
- label
- profile
- createdAt

SoundPack
- id
- key
- label
- profile
- createdAt

EnvironmentPack
- id
- key
- label
- lobbyPreset
- playPreset?
- createdAt

UserPresentationSelection
- id
- userId
- activeThemeKey
- activeSkinKey?
- activeMotionPackKey?
- activeSoundPackKey?
- sceneQualityMode
- reducedEffects
- reduceMotion
- updatedAt
```

## Token Architecture

Xtation should use a semantic token pipeline, not scattered hand-written color values.

Recommended layers:

```txt
tokens/
- foundation/
- semantic/
- sections/
- skins/
- modes/
```

Implementation direction:

- source tokens in structured JSON or TS
- semantic CSS custom properties at runtime
- optional token build pipeline for multi-platform outputs

Strong references:

- Style Dictionary supports token transformation across platforms and is forward-compatible with DTCG-style token definitions: [Style Dictionary overview](https://styledictionary.com/getting-started/installation/), [Design Tokens](https://styledictionary.com/info/tokens/)
- CSS custom properties and `@property` provide a stable runtime layer for semantic tokens and typed overrides: [MDN custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties), [MDN `@property`](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Properties_and_values_API/Registering_properties)

## Multi-Platform Rule

Xtation should not maintain different visual systems for web, desktop, and future mobile.

The same presentation model should drive:

- web app
- desktop app
- mobile companion later
- scene runtime overlays

Platform-specific fallback is allowed.
Platform-specific design forks should be avoided.

## Dusk Integration

Dusk should not have a separate theme engine.

Dusk should consume the same presentation system through:

- Dusk style pack
- voice/sound variant later
- motion intensity rules
- skin-linked visual treatment

Examples:

- a skin can give Dusk a different visual shell
- a mode can reduce Dusk motion during focus
- accessibility settings can simplify Dusk surfaces

## Avatar and Scene Integration

Avatar and scene should not invent their own visual language.

They should consume:

- environment packs
- avatar style packs
- motion packs
- sound packs
- section mood tokens

This keeps `Profile`, `Play`, and the 3D lobby aligned with the main app.

## Map Integration Later

The places/map layer should eventually consume the same presentation system.

Examples:

- map color style linked to active skin
- place markers styled by section mode
- multiplayer places view matching the user’s active pack

The map should not become visually unrelated to the rest of Xtation.

## Skin Quality Rules

Good skins:

- feel distinct
- remain readable
- keep navigation clear
- preserve interaction semantics
- work in both desktop and mobile constraints

Bad skins:

- change layout behavior unpredictably
- reduce contrast too far
- overload motion
- bury key actions
- make admin/productive areas harder to use

## Recommended Skin Philosophy

Xtation should prefer:

- strong identity
- calm surfaces
- clear semantic contrast
- controlled atmosphere
- limited but meaningful motion

Xtation should avoid:

- gimmick skins that break usability
- neon overload everywhere
- purely dark-mode-only thinking
- overdesigned panels with weak hierarchy

## Suggested V1 Packs

The first presentation packs should be simple and strong.

Suggested V1:

- `Core`
  - default Xtation pack
- `Dusk Protocol`
  - sharper, quieter, more operational
- `Fieldglass`
  - brighter, cleaner, more airy
- `Night Relay`
  - lower-light focused pack

These names are examples, not a locked catalog.

## Current Repo Alignment

Current repo already has:

- a settings foundation
- theme-like controls in the app shell
- store as a concept
- Dusk and avatar direction emerging

Current big gaps:

- no canonical token system
- no locked distinction between theme vs skin vs mode
- no catalog model for presentation packs
- no unified path between Store, Settings, Dusk, and future avatar scene surfaces

## Build Direction

Recommended build order:

### Phase 1

- lock semantic token vocabulary
- create one base theme
- create one base skin
- wire Settings to theme/skin selection

### Phase 2

- connect Store catalog to presentation entitlements
- connect Dusk style pack support
- connect scene environment pack support

### Phase 3

- add motion packs
- add sound packs
- add avatar style packs
- add map style packs later

### Phase 4

- add creator-facing presentation authoring only if the system proves stable

## Final Lock

The correct Xtation presentation model is:

- one engine
- one semantic token system
- many optional presentation packs
- accessibility and performance overrides always respected

Store sells the packs.
Settings activates the packs.
Dusk, Avatar, Play, Profile, Lab, and Multiplayer all consume the same presentation language.
