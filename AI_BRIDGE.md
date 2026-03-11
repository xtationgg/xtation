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

## Codex Task Queue (from Claude)

Priority-ordered work for Codex to execute. Check off as completed.
All work should pass `npm run build` and `npx vitest run` (191 tests) before committing.

### P1: Scene Visual Presence (Codex-locked zone)
- [x] Review Claude's overlay changes in ProfileLobbyScene.tsx (HUD gating, relay cleanup)
- [x] Continue scene-side avatar work: stronger silhouette, cleaner subject separation, better lighting
- [x] Consider model swap from male_anatomy.glb to walking-man.glb (tested live; rejected as the default because it weakens the hero shot and subject framing)

### P2: Quest Completion Loop Polish
- [ ] Review new QuestDebriefPanel.tsx (components/Play/QuestDebriefPanel.tsx) — check it matches XTATION design language
- [ ] Add entrance animation to debrief panel (fade-in + scale, use existing animate-fade-in or similar)
- [ ] Consider adding a confetti/particle burst on quest completion via presentation events

### P3: Closed-Beta Surface Polish
- [ ] Audit all remaining legacy branding strings (grep for "Hextech", "Summoner", "League", "Riot", "Mid_Lane" etc.)
- [ ] Review Settings section for any exposed dev-only toggles that shouldn't ship in closed beta
- [ ] Check Multiplayer section for placeholder/stub content that looks broken to real users

### P4: Return/Resume Flow
- [ ] Test the station continuity flow: close app, reopen, verify state restores cleanly
- [ ] Verify onboarding handoff → Play starter relay works end-to-end
- [ ] Check that Dusk briefs persist across sessions

### Rules for This Queue
- Each task is independent — skip any that conflict with active locks
- Always run build + tests after changes
- Update this file and AI_BRIDGE.md after completing a batch
- Do NOT restructure locked architecture (7 top-level sections, scene API channel, presentation events system)

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

- Completed the active scene-side portrait pass in the locked Profile zone
- The profile stage now has a stronger subject-first baseline:
  - closer hero camera framing
  - calmer orbit
  - brighter portrait-core bureau lighting
  - clearer front-biased character orientation
  - larger profile-presentation fit so the subject occupies the stage more assertively
- The embedded avatar-lobby runtime was rebuilt from source and resynced into `public/avatar-lobby`
- The editable scene source snapshot now lives inside the repo at:
  - `/Users/sarynass/dyad-apps/CLient-D82pm/scene-source/avatar-lobby/demo.tsx`
- The bottom-right EyeOrb overlay remains removed, so the stage reads cleaner
- The `walking-man.glb` swap was tested live and rejected as the default:
  - worse hero framing
  - weaker subject presence
- Verified:
  - `npm run build` passed
  - `npx vitest run` passed `195/195`
- Latest backup:
  - `/Users/sarynass/Desktop/html/backups/xtation-source-backup-20260311-214254.zip`

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
