# XTATION Lab V1

## Purpose

This document defines Lab as a canonical Xtation section.

It answers:

- what Lab is
- what belongs in Lab
- what does not belong in Lab
- how Lab should relate to Dusk
- how Knowledge, Automations, Templates, and Assistant Workspaces fit together
- how Lab should be built without becoming a dumping ground

## Core Definition

Lab is the system-building section of Xtation.

Simple meaning:

- Play = do the work
- Profile = see your identity and progress
- Lab = build the systems that help you work better

Lab is:

- your workshop
- your automation layer
- your assistant workspace
- your knowledge system

Lab is not:

- the main quest execution surface
- the user profile page
- inventory storage
- a random chat screen
- a generic tools junk drawer

## Main Principle

Lab should help the user:

- think better
- structure better
- automate better
- reuse better

Lab should produce systems that improve:

- Play
- Profile
- Multiplayer
- Inventory use
- Dusk intelligence

If a Lab feature does not clearly help one of those, it should be questioned.

## Locked Lab Structure

Lab should be structured like this:

```txt
Lab
- Workspace
- Automations
- Assistants
- Knowledge
- Templates
- Extensions
- Media Ops later
- Devices later
```

This is the canonical structure.

## 1. Workspace

Purpose:

- give the user one clear Lab home
- show what is active
- reduce the feeling of too many disconnected tools

Workspace should contain:

- active assistant projects
- recent notes and canvases
- active automations
- suggested templates
- Dusk brief for current work

Workspace should feel like:

- a command deck
- a systems overview
- a calm home for deeper work

Workspace should not become:

- a dashboard wall of random cards
- a second settings page
- a giant analytics surface

## 2. Automations

Purpose:

- let users create repeatable rules and actions

Automation should be built on engine events, not random UI callbacks.

Core rule:

- Lab automations react to canonical engine events

Examples:

- when quest completes, suggest reward or next quest
- when session starts, enable focus mode
- when note gets tagged a certain way, suggest quest extraction
- when a player changes state, queue follow-up

### Automation Model

Recommended shape:

```txt
LabRule
- id
- userId
- name
- enabled
- trigger
- conditions[]
- actions[]
- createdAt
- updatedAt
```

### Trigger Examples

- quest created
- quest started
- quest completed
- session started
- session ended
- milestone completed
- note created
- note updated
- player signal detected later

### Action Examples

- create reminder
- create draft quest
- create note
- start focus preset
- assign template
- trigger Dusk brief

### Automation Rule

V1 should not be a giant Zapier clone.

V1 should be:

- local-first
- event-driven
- understandable
- visible
- reversible when possible

External automations can come later through extensions or webhooks.

## 3. Assistants

Purpose:

- make AI work structured instead of chat-chaotic

Assistant work should not live as unbounded chat logs.

The best structure is:

```txt
Assistants
- Projects
- Conversations
- Notes
- Generated Assets
- Linked Quests
- Linked Automations
- Tools
```

### Assistant Projects

Each assistant project should represent a real work context.

Examples:

- startup research
- app architecture
- brand strategy
- marketing campaign
- content planning

### Assistant Rule

Each assistant project should have:

- one purpose
- one context window
- linked notes
- linked quests/projects
- linked generated outputs

This makes assistants feel like collaborators, not chat windows.

### Relationship With Dusk

Dusk is the assistant intelligence layer across Xtation.

Lab is the best place for Dusk's richest workspace mode.

So:

- Dusk exists across Xtation
- Lab is where Dusk gets its deepest project/workspace form

## 4. Knowledge

Purpose:

- store ideas, research, notes, canvases, and structured thinking

This is the Obsidian-like part of Xtation.

It should live in Lab, not Inventory.

### Locked Knowledge Structure

```txt
Knowledge
- Home
- Notes
- Canvas
- Collections
- Graph
- Templates
- Capture
```

### Notes

Notes should support:

- markdown-like authoring
- typed properties
- internal links
- attachments
- links to quests, projects, self-tree nodes, players, and places

### Canvas

Canvas should support:

- freeform visual boards
- notes and media on a 2D plane
- relationship mapping
- planning boards
- operation boards

### Collections

Collections should act like filtered smart views over knowledge.

Examples:

- all notes tagged `research`
- all notes linked to a project
- all notes with due date

### Graph

Graph should exist, but not dominate the product.

It is a secondary sensemaking view, not the main workflow.

### Capture

Capture should support:

- quick text capture
- web/link capture
- file drop
- note creation from Dusk

## Knowledge Principles Inspired by Obsidian

The strongest ideas to carry forward are:

- vault-style ownership
- local-first data
- internal links
- properties
- canvas boards
- open-ish storage formats

Official references:

- [How Obsidian stores data](https://help.obsidian.md/data-storage)
- [Internal links](https://help.obsidian.md/Linking%20notes%20and%20files/Internal%20links)
- [Properties](https://help.obsidian.md/plugins/properties)
- [Canvas](https://help.obsidian.md/Plugins/Canvas)

Important signals:

- Obsidian vaults are local-first folders
- internal links are core to knowledge structure
- typed properties make notes more queryable
- canvas uses an open JSON-based format

### Xtation Difference

Xtation Knowledge should go beyond Obsidian by linking notes directly to:

- quests
- projects
- self-tree nodes
- players
- places
- operations
- automations

This is the main advantage.

Xtation Knowledge is not just for writing.
It is for actionable system-building.

## 5. Templates

Purpose:

- help users reuse good structures instead of starting from scratch

Template types should include:

- note templates
- canvas templates
- assistant project templates
- quest chain templates
- automation templates
- media workflow templates later

Templates should be:

- lightweight
- reusable
- easy to clone
- easy to customize

## 6. Extensions

Purpose:

- allow Lab to grow without bloating the core

Extensions are optional modules.

Examples:

- external integrations
- advanced automations
- premium assistant packs
- export tools
- publishing tools

Core rule:

Lab should stay useful without extensions.

## 7. Media Ops Later

Media Ops belongs in Lab, but should not be forced into V1.

When added, it should be:

```txt
Media Ops
- Accounts
- Planner
- Publishing
- Campaigns
- Analytics
```

This is valid because Media Ops is a system-building layer, not a core identity or inventory layer.

## 8. Devices Later

Device control also belongs in Lab conceptually.

Examples:

- phone-triggered workflows
- gadget control
- remote launch helpers
- environment presets later

But this should come after core Lab objects are stable.

## Canonical Object Model

Recommended Lab-side objects:

```txt
LabWorkspace
- id
- userId
- title
- description?
- activePanel
- linkedProjectIds[]
- linkedQuestIds[]
- createdAt
- updatedAt

LabRule
- id
- userId
- name
- enabled
- trigger
- conditions[]
- actions[]
- createdAt
- updatedAt

AssistantProject
- id
- userId
- title
- purpose
- status
- linkedQuestIds[]
- linkedAutomationIds[]
- linkedDocumentIds[]
- createdAt
- updatedAt

KnowledgeVault
- id
- userId
- name
- storageMode
- createdAt
- updatedAt

KnowledgeDocument
- id
- vaultId
- type
- title
- slug
- content
- format
- properties
- tags
- createdAt
- updatedAt
- archivedAt?

KnowledgeLink
- id
- fromDocumentId
- toDocumentId
- kind

LabTemplate
- id
- userId
- type
- title
- payload
- createdAt
- updatedAt
```

## Storage Model

### Core Rule

Knowledge should be local-first.

Recommended approach:

- Desktop later: real file-backed vault when practical
- Web now: IndexedDB/local-first store with export/import
- Cloud: sync layer and backup layer, not the only source of truth

This follows the strongest part of Obsidian's model while staying realistic for Xtation.

### Document Format Rule

Do not start with one giant opaque editor blob.

Prefer:

- markdown-like note content
- structured properties
- link metadata
- canvas JSON

## Recommended Editor Direction

Xtation should not try to recreate every Obsidian behavior from scratch.

Best likely implementation direction:

- structured editor foundation like Tiptap
- optional collaboration layer later through Yjs
- canvas as a separate document type

Official references:

- [Tiptap collaboration overview](https://tiptap.dev/docs/collaboration/getting-started/overview)
- [Yjs introduction](https://docs.yjs.dev/)
- [Yjs collaborative editor guide](https://docs.yjs.dev/getting-started/a-collaborative-editor)
- [Yjs awareness](https://docs.yjs.dev/getting-started/adding-awareness)

Important signals:

- Yjs supports real-time sync and offline-friendly collaboration patterns
- awareness should be used carefully and not overload the user
- schema discipline matters when collaboration is added

### Collaboration Rule

Do not make collaboration a V1 requirement for all Lab knowledge.

Start with:

- local-first solo power
- export/import
- good structure

Then add:

- selective collaboration
- shared documents
- shared canvases

## Automation and External Workflow Rule

Lab should have its own internal automation engine first.

External workflow systems should be optional extensions later.

Examples:

- webhook-based automations
- external connectors
- n8n-style flows

Official reference:

- [n8n workflows](https://docs.n8n.io/workflows/)

Important rule:

Xtation should not depend on an external automation platform to make Lab useful.

## Dusk Relationship

Lab is the richest home for Dusk.

Dusk should help Lab by:

- summarizing notes
- extracting action items
- generating templates
- proposing automations
- linking notes to quests and projects
- drafting assistant project briefs

But Dusk should still act through explicit tools and permissioned actions.

## Current Repo Alignment

Current useful signals:

- [UiLab.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/UiLab/UiLab.tsx#L1) shows a prototype sandbox direction
- [registry.ts](/Users/sarynass/dyad-apps/CLient-D82pm/components/UiLab/registry.ts#L1) shows a small prototype registry
- [HextechAssistant.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Features/HextechAssistant.tsx#L2250) already contains workspace/focus interactions that hint at future structured assistant behavior

Current interpretation:

- `UiLab` is a prototype staging area, not the final Lab architecture
- `HextechAssistant` contains useful interaction ideas, but not the final assistant/workspace structure

## UX Rules

### Good Lab UX

- calm home workspace
- strong hierarchy
- one primary action per view
- advanced systems behind clear sections
- powerful but understandable

### Bad Lab UX

- random tool pile
- equal-priority panels everywhere
- giant automation jargon walls
- chat-first clutter
- graph fetish as the default workflow

## Build Order

### Lab V1

- Workspace shell
- Automation event model
- Assistant projects
- Knowledge vault
- Note templates
- note -> quest/project/self-tree linking

### Lab V2

- Canvas boards
- Collections
- stronger template engine
- richer Dusk actions
- shared automation packs

### Lab V3

- selective collaboration
- extension system
- media ops
- device control

## Final Summary

Lab should be the system factory of Xtation.

It should give the user:

- a home for structured thinking
- a home for assistant projects
- a home for automations
- a home for reusable templates

Lab should feel like:

- a workshop
- a control room
- a second brain

Not:

- a junk drawer
- a raw chatbot tab
- an overbuilt no-code maze

That is the correct foundation for making Xtation programmable, intelligent, and still understandable.
