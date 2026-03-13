# START HERE — XTATION

> Give this single file to any AI to fully resume the project.
> This file lives in the repo root and is always up to date.

---

## What This Is

**XTATION** is a personal life operating system with game-client UX.
Inspired by Control (game). Not a website — a life-OS.
Built with React 19 + TypeScript + Vite + Three.js + Supabase + Electron + Capacitor.

**Repo:** `/Users/sarynass/dyad-apps/CLient-D82pm/`
**GitHub:** `xtationgg/xtation`
**Obsidian Brain (44 notes, full context):** `~/Desktop/workspace/xtation-brain/`

---

## Step 1 — Read These 3 Files First (in order)

```
1. ~/Desktop/workspace/xtation-brain/RESUME.md
   → Where we stopped + what to do next (updated every session)

2. ~/Desktop/workspace/xtation-brain/project/FRONTIER.md
   → What is actively being worked on right now

3. /Users/sarynass/dyad-apps/CLient-D82pm/AI_BRIDGE.md
   → What Codex built since last session + current file locks
```

---

## Step 2 — Deeper Context (only if needed)

**Obsidian vault** `~/Desktop/workspace/xtation-brain/`:
```
HOME.md                    → full navigation to everything
BUILD-MAP.canvas           → visual map (open in Obsidian)
project/ROADMAP.md         → phases + checkboxes
project/STATUS.md          → build health + all 7 sections
project/SECTIONS.md        → section roles + key files
project/INFRASTRUCTURE.md  → GitHub, Vercel, Supabase, Electron, env vars
project/AI-COORDINATION.md → Claude + Codex rules
01-architecture/           → Dusk, Skins, Avatar/Scene, Audio, Events
02-tools/                  → Design Mode, Scene Studio
08-user-notes/             → user's personal priorities, ideas, feedback
```

**Repo handoff docs** (more technical depth):
```
GIVE_THIS_TO_ANY_AI_TO_CONTINUE_ON_PROJECT.txt  → detailed stop point
XTATION_NOW.md                                  → rolling checkpoint
XTATION_CONTINUATION_MAP_V1.md                  → full implementation map
```

---

## Critical Rules (Before Touching Anything)

- **Codex** (gpt-5.4) is primary builder — Claude reads + advises, does NOT edit repo files without explicit user permission
- **Always check `AI_BRIDGE.md` Current Locks** before suggesting any file changes
- After any change: `npm run build` + `npm test` must pass
- Do NOT open new subsystems — project is in closed-beta polish phase
- Do NOT re-decide locked architecture (7 sections are final, no new top-level nav)
- Scene Studio is a **separate project** at `~/Desktop/html/` — has its own AI handoff: `GIVE_THIS_TO_ANY_AI_FOR_SCENE_STUDIO.txt`

---

## Current State Snapshot

| | |
|--|--|
| Build | ✅ passing |
| Tests | ✅ 240/240 |
| Phase | 🔴 Phase 3 — Closed-beta polish |
| Local URL | `http://127.0.0.1:5176/` |
| Active work | Inventory redesign (Design Mode v3.1) + beta sweep |
| Locked | `Profile.tsx`, `ProfileLobbyScene.tsx`, `scene-source/` → Codex |
| Last backup | `~/Desktop/html/backups/xtation-source-backup-20260312-033032.zip` |

---

## User Notes to Check

```
~/Desktop/workspace/xtation-brain/08-user-notes/priorities/INDEX.md
→ User's personal priorities — these override the official frontier

~/Desktop/workspace/xtation-brain/00-inbox/
→ Notes the user dropped between sessions
```
