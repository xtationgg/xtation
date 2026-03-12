# XTATION Scene Studio Integration V1

This document defines the working split between:

- the external Scene Studio source project
- the XTATION runtime and Creative Ops system

## Canonical Split

### Scene Studio source

Current location:
- `/Users/sarynass/Desktop/html`

Role:
- canonical editable authoring environment
- owns low-level scene authoring
- owns project save/load
- owns timeline authoring
- owns cue/state authoring
- owns runtime pack export generation

It should not be treated as:
- the XTATION runtime
- the XTATION admin layer
- just an offline build target

### XTATION runtime

Current location:
- `/Users/sarynass/dyad-apps/CLient-D82pm`

Role:
- consumer of published scene packs / skin packs
- owns semantic trigger binding
- owns skin activation
- owns Creative Ops preview/import/publish/rollback
- owns Profile scene runtime integration

It should not become:
- the full low-level scene editor
- the canonical source of scene authoring truth

### Offline package

Role:
- export/release artifact only
- portable runtime snapshot for demos/review/offline handoff

It should never become:
- the main authoring system
- the canonical editable project source

## External Studio Read Order

Any AI or engineer working on the external studio should read:

1. `/Users/sarynass/Desktop/html/GIVE_THIS_TO_ANY_AI_FOR_SCENE_STUDIO.txt`
2. `/Users/sarynass/Desktop/html/docs/scene-studio-project-format.md`
3. `/Users/sarynass/Desktop/html/docs/locked-lobby-architecture.md`
4. `/Users/sarynass/Desktop/html/docs/lobby-interaction-matrix.md`
5. `/Users/sarynass/Desktop/html/docs/scene-api-integration.md`

## XTATION Read Order For Integration

Any AI or engineer working on the XTATION side should read:

1. `/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_CONTINUATION_MAP_V1.md`
2. `/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_NOW.md`
3. `/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_AVATAR_SCENE_V1.md`
4. `/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_CREATIVE_OPS_V1.md`
5. `/Users/sarynass/dyad-apps/CLient-D82pm/src/admin/creativeOps.ts`
6. `/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/ProfileLobbyScene.tsx`
7. `/Users/sarynass/dyad-apps/CLient-D82pm/src/sceneStudio/runtimePack.ts`

## Integration Contract

The Studio should export:

- versioned runtime-safe scene pack data
- pack metadata
- cue/state definitions
- camera/light/screen defaults
- allowed trigger bindings
- asset manifest

XTATION should import:

- published scene packs
- published skin packs
- optionally avatar-related presentation packs later

Current runtime-pack receiving boundary:

- `/Users/sarynass/dyad-apps/CLient-D82pm/src/sceneStudio/runtimePack.ts`

Current behavior:

- validates XTATION runtime-pack `version 1`
- resolves included exported segments
- summarizes an incoming pack against current Creative Ops state
- applies a pack into Creative Ops `draft` or `published` state without UI coupling
- keeps import segment-aware so incomplete early studio exports can update only the parts they actually carry

XTATION should bind those packs to semantic product events such as:

- `profile.status.open`
- `play.session.start`
- `quest.completed`
- `dusk.brief.loaded`
- `profile.avatar.loadout.ready`

## What XTATION Should Keep Doing Now

While the external studio is being built, XTATION should focus on:

- closed-beta readiness
- continuity and resume flow
- runtime pack import contract
- Creative Ops import/publish flow
- Profile scene runtime consumption

XTATION should avoid:

- over-investing in hand-tuned profile art direction
- building a second low-level scene editor
- inventing scene save formats separately from the studio

## What The Studio Should Build Next

Priority order:

1. versioned in-source project schema
2. project save/load
3. runtime export pack pipeline
4. migration of current presets/macros/sequences/timeline state into that schema
5. deeper authoring tooling after schema stability
