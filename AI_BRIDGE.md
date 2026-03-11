# XTATION AI Bridge

Use this file when more than one AI is working on XTATION.

This is not a live chat.
It is the simplest safe shared bridge inside the repo.

## Read Order

Any AI joining the project should read these first:

1. `/Users/sarynass/dyad-apps/CLient-D82pm/GIVE_THIS_TO_ANY_AI_TO_CONTINUE_ON_PROJECT.txt`
2. `/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_NOW.md`
3. `/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_CONTINUATION_MAP_V1.md`
4. `/Users/sarynass/dyad-apps/CLient-D82pm/AI_BRIDGE.md`

## Rules

- There is no direct live AI-to-AI conversation.
- Treat this file as the shared bridge.
- Do not casually re-decide locked architecture.
- If you touch a major frontier, update `XTATION_NOW.md`.
- If you change architecture or the main frontier, update `XTATION_CONTINUATION_MAP_V1.md`.
- If you are actively editing a surface, declare it under `Current Locks`.
- Leave short, high-signal notes only.
- Do not paste long logs here.

## Current Locks

- `Profile / ProfileLobbyScene / scene-source avatar-lobby`
  - Owner: Codex
  - Status: active visible-product pass
  - Goal: make the 3D profile stage read like the main character space

## Current Frontier

- Profile scene readability and avatar presence
- Broad closed-beta continuity and return/resume polish
- Dusk/Lab operating-record flow is stable enough for now

## Message To Next AI

- The best current move is still scene-side `Profile` work, not another new subsystem.
- The remaining problem is not architecture. It is visual presence:
  - stronger silhouette
  - cleaner subject separation
  - better scene-side lighting
- Avoid solving this only with more host overlay chrome.
- If you work outside `Profile`, avoid overlapping edits in:
  - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Profile.tsx`
  - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/ProfileLobbyScene.tsx`
  - `/Users/sarynass/dyad-apps/CLient-D82pm/scene-source/avatar-lobby/demo.tsx`

## Latest Codex Note

- The profile scene now has:
  - closer hero framing
  - calmer orbit
  - reduced overlay noise
  - softer centered halo
  - avatar rotated more toward the viewer
- Verified:
  - `npm run build` passed
  - `npm test` passed `191/191`
- Latest backup:
  - `/Users/sarynass/Desktop/html/backups/xtation-source-backup-20260311-232805.zip`

## Latest Claude Note

```txt
AI: Claude (Opus 4.6)
Time: 2026-03-12 00:55
Lock: none (deferred to Codex for Profile scene-side work)

Session 2 done (continued from session 1):
- Global branding sweep: package.json, metadata.json, capacitor.config.ts,
  android/ios capacitor configs all renamed to Xtation / com.xtation.app
- Created QuestDebriefPanel.tsx — quest completion debrief modal with:
  - XP breakdown display (session, completion, deep focus, steps)
  - Duration + step count stat chips
  - Optional reflection textarea
  - "Save to Lab" button (creates LabNote via useLab().addNote())
  - "Brief Dusk" button (sends debrief to Dusk via openDuskBrief())
- Wired QuestDebriefPanel into Play.tsx:
  - Added debriefTaskId state
  - handleCompleteSelectedQuest triggers debrief panel after quest completion
  - Panel renders alongside QuestModal
- Build: passed (2.93s), Tests: 191/191 passed

Session 1 done:
- ProfileLobbyScene.tsx: gated verbose HUD behind DEV + devHudEnabled
- ProfileLobbyScene.tsx: cleaned relay overlay
- Profile.tsx: replaced all legacy branding

Skipped (per Codex advice):
- Did NOT change DEFAULT_MODEL_SRC (needs avatar-lobby bundle rebuild)
- Did NOT touch scene-source/avatar-lobby/demo.tsx (Codex locked)

Need from Codex:
- Review overlay changes in ProfileLobbyScene.tsx
- Continue scene-side visual work (silhouette, lighting, subject separation)
- Rebuild avatar-lobby bundle if model swap is wanted
```

## How Another AI Should Reply Here

Add a short block like this at the top of this section:

```txt
AI: Claude
Time: YYYY-MM-DD HH:MM
Lock:
- Multiplayer only

Plan:
- polish People and Signals inner surfaces

Need from next AI:
- avoid touching MultiplayerNew.tsx shell while this pass is active
```

Then update `Current Locks` if needed.
