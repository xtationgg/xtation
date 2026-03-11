# Avatar Lobby Source Snapshot

This folder vendors the editable source snapshot that was previously living only in an external prototype workspace.

## Why this exists

XTATION uses the embedded runtime in:

- [public/avatar-lobby/index.html](/Users/sarynass/dyad-apps/CLient-D82pm/public/avatar-lobby/index.html)

But a meaningful part of the editable scene source had been outside the repo in:

- `/Users/sarynass/Desktop/html/src/components/ui/demo.tsx`
- `/Users/sarynass/Desktop/html/src/components/ui/halide-topo-hero.tsx`

That was a continuity risk.

This folder fixes that by storing the relevant source snapshot inside XTATION itself.

## What is here

- [demo.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/scene-source/avatar-lobby/demo.tsx)
- [halide-topo-hero.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/scene-source/avatar-lobby/halide-topo-hero.tsx)

## How to think about it

- `public/avatar-lobby/*` = embedded runtime actually used by the XTATION app
- `scene-source/avatar-lobby/*` = editable source snapshot for future deeper scene/runtime work

## Important note

This is a vendored source snapshot, not yet a fully re-integrated build pipeline inside the main XTATION repo.

So for future work:

1. edit the source snapshot here first
2. keep changes consistent with the embedded runtime contract:
   - [scene-api-contract.json](/Users/sarynass/dyad-apps/CLient-D82pm/public/avatar-lobby/scene-api-contract.json)
3. if the runtime bundle is rebuilt again, treat this repo copy as the primary source reference

## Legacy origin

The earlier external prototype workspace is still the historical origin:

- `/Users/sarynass/Desktop/html`

But continuity should now prefer the in-repo snapshot first.
