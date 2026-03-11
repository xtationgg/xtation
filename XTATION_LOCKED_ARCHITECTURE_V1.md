# XTATION Locked Architecture V1

## Purpose

This document is the canonical architecture map for Xtation.

It replaces scattered brainstorming as the primary product structure reference.

Use it to answer:

- what Xtation is
- which top-level sections exist
- what each section owns
- which shared layers cut across sections
- which domain objects are core now
- which future objects belong to later systems
- what should be built first

This document does not try to finalize every UI detail.
It locks the product structure and domain boundaries.

## Product Definition

Xtation is a personal operating system with a game-client interaction model.

Its core loop is:

1. Plan work as Projects and Quests.
2. Execute work in Play through Sessions and Steps.
3. Convert execution into XP, level, momentum, and progress.
4. Project that progress into identity, resources, people, places, automations, and unlocks.

The product is strongest when it behaves like:

- a personal execution engine
- a growth and identity system
- a systems-building lab
- a people and operations layer

It gets weaker when it behaves like:

- a generic dashboard
- a random AI chat wrapper
- a pure social app
- a map toy
- a store-first product

## Top-Level Information Architecture

Xtation should use exactly these top-level sections:

```txt
XTATION
- Play
- Profile
- Lab
- Multiplayer
- Inventory
- Store
- Settings
```

These sections are not equal feature pages.
They are roles in one operating system.

## Section Roles

### Play

Role:
- execute actions

Meaning:
- live operation room
- focus and execution surface
- where plans become real

### Profile

Role:
- identity and history

Meaning:
- personal record
- growth mirror
- memory of what the user has done and become

### Lab

Role:
- build systems

Meaning:
- automation factory
- assistant workspace
- planning and workflow design surface

### Multiplayer

Role:
- people

Meaning:
- people ops
- collaboration
- discovery
- shared coordination

### Inventory

Role:
- resources

Meaning:
- assets
- library
- tools
- loadouts
- capability support

### Store

Role:
- expansion

Meaning:
- modules
- skins
- templates
- unlocks
- optional enhancements

### Settings

Role:
- configuration

Meaning:
- policy system
- privacy and presence rules
- device and account behavior

## Locked Section Structure

### 1. Play

```txt
Play
- Active Quest
- Focus Workspace
- Session HUD
- Step Flow
- Linked Resources
- Linked People
- Linked Place
- Rewards
- Debrief
```

Play owns:

- current active quest state
- live session control
- in-session steps
- immediate linked context needed to perform work
- completion and pause flows

Play reads from:

- Profile for stats and progression
- Lab for automations and assistant actions
- Inventory for resources and loadouts
- Multiplayer for shared quests and focus rooms
- Places layer for quest-linked places

Play should not own:

- long-term planning systems
- note vaults
- people database management
- deep settings

### 2. Profile

```txt
Profile
- Identity
- Stats
- History
- Timeline
- Calendar
- Self Tree
- Titles
- Milestones
- Public Card later
```

Profile owns:

- personal identity surface
- lifetime progress
- history and timeline
- self tree
- profile-level presentation

Profile should not own:

- automations
- assistant workspaces
- multiplayer operations
- store catalog logic

### 3. Lab

```txt
Lab
- Workspace
- Automations
- Quest Chains
- Assistants
- Media Ops
- Templates
- Extensions
- Knowledge
- Devices later
```

Detailed structure:

```txt
Lab
- Workspace
- Automations
- Quest Chains
- Assistants
  - Projects
  - Conversations
  - Notes
  - Generated Assets
  - Linked Quests
  - Linked Automations
  - Tools
- Media Ops
  - Accounts
  - Planner
  - Publishing
  - Campaigns
  - Analytics
- Templates
- Extensions
- Knowledge
- Devices later
```

Lab owns:

- automation rules
- chain logic
- assistant workspaces
- templates
- system-building tools
- structured knowledge and notes
- future device control

Lab should not own:

- the main execution HUD
- core profile identity
- the entire people layer

### 4. Multiplayer

```txt
Multiplayer
- HQ
- People
- Teams
- Shared Quests
- Focus Rooms
- Discover
- Places
- Presence
- Ops
```

Multiplayer should be designed internally as people ops, even if the visible nav label stays "Multiplayer".

Multiplayer owns:

- player library
- relationships
- team/group coordination
- discovery
- shared quests
- focus/accountability rooms
- shared place coordination
- outreach and follow-up context

Multiplayer should not own:

- random solo notes
- global settings policy
- deep store logic
- standalone map empire behavior

### 5. Inventory

```txt
Inventory
- Assets
- Library
- Tools
- Loadouts
- Attachments
- Linked Objects
```

Inventory owns:

- physical items
- digital tools
- books, PDFs, articles, datasets, courses
- loadouts and resource bundles
- capability support and unlock links

Inventory should not own:

- identity history
- chat or social discovery
- deep writing workspace

### 6. Store

```txt
Store
- Themes
- Skins
- Sound Packs
- Play Environments
- Lab Modules
- Assistant Packs
- Templates
- Widgets
- Multiplayer Cosmetics
- Map Skins later
```

Store owns:

- optional expansions
- entitlements
- activation targets for other systems

Store should not own:

- fundamental core functionality
- any requirement to use Xtation's engine

### 7. Settings

```txt
Settings
- Account
- Interface
- Focus
- Privacy
- Multiplayer
- Notifications
- Data and Sync
- Lab
- Store and Unlocks
- Developer
```

Settings owns:

- account and device behavior
- feature settings
- privacy and presence
- unlock activation
- sync policy
- module flags

Settings should remain the policy layer for the rest of the system.

## Shared Cross-System Layers

The following are important layers, but should not be top-level navigation sections.

### Places Layer

```txt
Places
- My Places
- Nearby Search
- Business Search
- Quest Place Matching
- Route and Travel Context
- Shared Places
- Location Rules
- Performance by Place later
```

Places appears in:

- Play for quest-linked location
- Profile for place history
- Lab for location automations
- Multiplayer for meetups and shared coordination

Map rendering belongs primarily inside Multiplayer and Places workflows.

### Self Tree Layer

Self Tree lives inside Profile, but influences:

- quest alignment
- project structure
- assistant suggestions
- long-term growth analysis
- resource recommendations

### Attachments Layer

Attachments should be a shared support layer used by:

- Inventory
- Profile
- Lab
- Multiplayer
- Play

Heavy media should not live as ad hoc fields on unrelated domain objects.

### Timeline Layer

Timeline is a cross-system memory layer sourced from engine events.

It should eventually power:

- Profile history
- Multiplayer trace
- Lab triggers
- calendar projection
- after-action summaries

## Locked Domain Model

### Core Domain Objects

These define Xtation itself and should be treated as first-class system objects.

```txt
Core Domain
- UserProfile
- Project
- Quest
- Session
- Step
- Milestone
- SelfTreeNode
- InventoryItem
```

### Support Domain Objects

These are required for the architecture to stay clean.

```txt
Support Domain
- Attachment
- EntityLink
- EngineEvent
- CalendarItem
- Entitlement
```

### Future People Ops Domain

These belong to Multiplayer and adjacent systems, not the base engine.

```txt
People Ops Domain
- Player
- Relationship
- Team
- Organization
- Place
- SocialAccount
- Signal
- Touchpoint
- Watchlist
- Brief
- Operation
- Message later
```

## Canonical Object Ownership

This section defines where data belongs conceptually.

### Play-owned runtime state

- active quest id
- active session id
- focus workspace state
- session display state
- step completion interaction state

### Profile-owned state

- profile identity
- personal presentation
- self tree
- titles
- progress history projection

### Lab-owned state

- automations
- quest chains
- assistant workspaces
- templates
- extensions
- knowledge workspaces
- device integrations later

### Multiplayer-owned state

- players
- relationships
- teams
- shared quests
- focus rooms
- discovery/watchlists later
- place sharing context
- outreach context

### Inventory-owned state

- resource records
- asset metadata
- loadouts
- item capabilities
- linked attachments

### Store-owned state

- product catalog
- entitlement grants
- available packs
- unlock metadata

### Settings-owned state

- device settings
- user settings
- privacy settings
- feature flags
- notification settings
- unlock activation

## Canonical Object Rules

### Quest

- "Quest" is the canonical product term.
- Existing "Task" naming can remain as a migration alias inside code until refactoring is safe.

### SelfTreeNode

SelfTreeNode should follow these rules:

- 6 fixed roots only:
  - Knowledge
  - Creation
  - Systems
  - Communication
  - Physical
  - Inner
- users may create nodes only under those roots
- root nodes cannot be deleted
- nodes represent capabilities, domains, practices, habits, or topics
- nodes do not represent one-off tasks

Recommended upgraded model:

```txt
SelfTreeNode
- id
- userId
- parentId?
- rootBranch
- name
- type
- description?
- linkedQuestIds[]
- linkedProjectIds[]
- progress?
- metadata?
- createdAt
- updatedAt
- archivedAt?
```

Suggested node types:

- Skill
- Topic
- Habit
- Practice
- Project
- Domain

### InventoryItem

Inventory should support both storage and function.

Inventory effects should be:

- unlock
- enable
- support
- attach

Inventory effects should not yet be:

- raw XP boosts
- stat multipliers that distort the core engine

Recommended direction:

```txt
InventoryItem
- id
- userId
- type
- subtype?
- title
- description?
- tier
- quantity?
- status
- visibility
- tags?
- createdAt
- updatedAt

ItemAttachment
- id
- itemId
- kind
- url
- title?
- createdAt

ItemCapability
- id
- itemId
- effectType
- effectValue?
- scope?
- createdAt
```

## UI and Product Rules

### Simplicity Rule

Do not create more top-level sections to solve complexity.

Complexity should be handled by:

- stronger object boundaries
- progressive disclosure
- one clear primary action per surface
- fewer equal-priority panels

### AI Rule

AI is an enhancement layer, not a dependency layer.

AI should help with:

- summarization
- extraction
- prioritization
- drafting
- linking
- recommendation

AI should not replace:

- the core quest engine
- the core settings system
- the base data model

### Map Rule

Map should not become a separate product pillar.

Map is:

- a Places layer
- a Multiplayer tool
- a context tool for Play and Lab

### Store Rule

Store sells expansion, not necessity.

Store should never own the basic ability to use Xtation well.

## Current Repo Alignment

These areas are already strong:

- quest and session engine
- XP and progression logic
- user-scoped settings foundation

These areas are currently fragmented:

- inventory models
- profile persistence
- people and multiplayer models
- attachment ownership

This means the next architecture work should favor unification over more feature spread.

## Locked Build Order

There are two valid build orders: one for product gravity and one for engineering dependency.

### Product Gravity Order

This is the order that creates the strongest user-facing experience:

1. Play
2. Profile
3. Lab
4. Multiplayer
5. Inventory
6. Settings
7. Store

### Engineering Dependency Order

This is the order that reduces architectural risk:

1. Settings foundation
2. Core domain cleanup
3. Play
4. Profile cleanup
5. Lab foundation
6. Multiplayer people ops
7. Inventory unification
8. Store entitlements

## What To Build Next

The best next step is not more ideation.

It is:

1. lock the canonical domain model
2. unify duplicate inventory/profile/people models
3. define Play as the primary execution surface
4. define Lab as the structured systems workspace
5. evolve Multiplayer into people ops instead of tab sprawl

## Final Summary

Xtation should be understood as:

- Play = do
- Profile = become
- Lab = design systems
- Multiplayer = coordinate with people
- Inventory = use resources
- Store = expand the system
- Settings = control the system

That is the locked architecture.

Anything that does not clearly strengthen one of those roles should be questioned before it is built.
