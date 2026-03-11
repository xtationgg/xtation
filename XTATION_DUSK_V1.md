# XTATION Dusk V1

## Purpose

This document defines Dusk as a canonical Xtation system.

It answers:

- what Dusk is
- where Dusk appears
- how Dusk works offline and online
- how Dusk should use tools and permissions
- how Dusk should interact with Play, Profile, Lab, Multiplayer, Inventory, and Settings
- how Dusk should be implemented safely across web, desktop, and future mobile companion surfaces

This document is not a prompt template.
It is the product and system architecture for Dusk.

## Core Definition

Dusk is the primary interaction intelligence of Xtation.

Dusk is:

- the assistant character
- the command layer
- the orchestration layer for AI-assisted work
- the bridge between user intent and Xtation tools

Dusk is not:

- the user avatar
- the 3D scene runtime
- a random floating chatbot
- the source of truth for Xtation domain data

## Separation Rule

Xtation must keep these three things separate:

```txt
User Avatar
- represents the user
- profile and play presence

Dusk
- assistant character
- reasoning and command layer

Scene Runtime
- 3D rendering module
- visual environment and animation layer
```

They may connect, but they are not the same object.

## Dusk Product Role

Dusk should make Xtation feel:

- guided
- alive
- responsive
- easier to operate

Dusk should reduce cognitive load, not increase it.

The best interpretation is:

- Play without Dusk must still work
- Xtation without AI must still work
- Dusk should make Xtation faster, clearer, and more adaptive

## Dusk Modes

Dusk should exist in 3 operating modes.

### 1. Local Dusk

Purpose:

- work fully offline
- operate on local Xtation state

Local Dusk should be able to:

- create and update quests
- start and stop sessions
- summarize recent activity from local state
- suggest next actions
- help inside Play and Lab
- run deterministic approved local automations

Local Dusk does not require an external AI provider.

Local Dusk should be useful even when:

- internet is unavailable
- user has no API key
- cloud providers fail

### 2. Connected Dusk

Purpose:

- use AI providers and cloud services when online

Connected Dusk should be able to:

- research
- summarize
- draft
- enrich
- suggest systems and automations
- reason across larger contexts
- use external tools and MCP-style integrations when allowed

### 3. Companion Dusk

Purpose:

- lightweight mobile and web companion presence

Companion Dusk should focus on:

- quick capture
- quick commands
- reminders
- status summaries
- fast note or quest creation
- inbox/brief access

Companion Dusk is not full desktop parity.

## Surface Map

Dusk should appear across Xtation with different intensity.

### Play

Role:

- coach
- session operator
- quick command helper
- reward/debrief narrator

### Profile

Role:

- reflection guide
- growth summarizer
- self-tree guide

### Lab

Role:

- systems copilot
- assistant workspace engine
- automation builder helper
- knowledge summarizer

### Multiplayer

Role:

- briefing helper
- player summary generator
- outreach suggestion layer

### Inventory

Role:

- asset matcher
- resource recommender
- context-aware attachment helper

### Settings

Role:

- explain options
- guide setup
- manage provider connections and permissions

## Primary Design Rule

Dusk should be present, but not intrusive.

Good Dusk presence:

- compact command input
- contextual action bar
- expandable side panel
- full workspace in Lab
- optional voice later

Bad Dusk presence:

- covering primary workflows
- interrupting constantly
- forcing chat as the only way to do things
- becoming the only way to operate Xtation

## Dusk System Layers

Dusk should be built as these layers:

```txt
Dusk
- Persona Layer
- Runtime Layer
- Tool Layer
- Memory Layer
- Permission Layer
- Provider Layer
- Surface Layer
- Audit Layer
```

### Persona Layer

Owns:

- name: Dusk
- tone
- communication style
- cosmetic variations later
- contextual behavior rules

Persona should be stable, recognizable, and brand-consistent.

### Runtime Layer

Owns:

- local vs connected mode
- task/run lifecycle
- job status
- fallback behavior
- section-aware behavior

### Tool Layer

Owns:

- callable tools
- tool metadata
- tool safety class
- tool input/output contracts

### Memory Layer

Owns:

- current context
- short-term working memory
- section-scoped context
- project/workspace context
- preferred workflows

### Permission Layer

Owns:

- what Dusk can see
- what Dusk can suggest
- what Dusk can draft
- what Dusk can execute
- what always requires confirmation

### Provider Layer

Owns:

- provider adapters
- API keys and connection settings
- provider-specific capability mapping
- local model integration later

### Surface Layer

Owns:

- command bar
- compact assistant panel
- full Lab workspace
- notifications and follow-up UI

### Audit Layer

Owns:

- Dusk run log
- tool call history
- confirmation history
- failures
- admin/support inspection path

## Canonical Object Model

Recommended conceptual objects:

```txt
DuskProfile
- id
- userId
- personaId
- preferredMode
- voiceEnabled
- providerPreference
- createdAt
- updatedAt

DuskProviderConfig
- id
- userId
- provider
- mode
- keySource
- model
- enabled
- createdAt
- updatedAt

DuskTool
- id
- name
- scope
- riskLevel
- inputSchema
- outputSchema
- enabled

DuskPermissionPolicy
- userId
- toolName
- actionLevel
- allowed
- requiresConfirmation
- createdAt
- updatedAt

DuskRun
- id
- userId
- section
- mode
- provider
- status
- intent
- toolCalls[]
- startedAt
- endedAt?

DuskMemoryScope
- id
- userId
- scopeType
- scopeRefId?
- summary
- updatedAt
```

## Tool System

This is the most important implementation rule.

Dusk should not perform raw freeform actions against the app.

Dusk should act through explicit tools.

### Tool Principles

Each tool should have:

- a name
- a clear contract
- scope
- risk class
- input validation
- output validation
- audit support

### Example Tool Families

#### Core Xtation Tools

- `quest.create`
- `quest.update`
- `quest.complete`
- `session.start`
- `session.pause`
- `session.stop`
- `step.toggle`
- `project.create`
- `project.update`

#### Profile Tools

- `self_tree.link_quest`
- `self_tree.suggest_node`
- `profile.summarize_progress`

#### Lab Tools

- `automation.create_draft`
- `automation.enable`
- `template.create`
- `knowledge.create_note`
- `knowledge.extract_tasks`

#### Multiplayer Tools

- `player.open_brief`
- `player.create_note`
- `player.add_watch`
- `outreach.create_draft`

#### Inventory Tools

- `inventory.link_item`
- `inventory.find_resource`
- `inventory.attach_file`

### Risk Classes

Recommended classes:

- `read_only`
- `draft_only`
- `safe_write`
- `high_impact_write`
- `admin_only`

## Permission Model

Dusk must never be treated as unrestricted magic.

Recommended action levels:

```txt
Action Levels
- suggest
- draft
- ask_before_acting
- auto_run_approved_safe_actions
- restricted
```

### Always Require Confirmation

These should generally require explicit confirmation:

- deleting user content
- billing changes
- publishing externally
- sending messages externally
- changing admin/role state
- bulk destructive edits

### Admin Restriction Rule

Admin actions should never run only because the model inferred that they are useful.

## Memory Model

Dusk memory should be structured and scoped.

Not all memory should be global.

### Memory Scopes

- `session`
- `quest`
- `project`
- `lab_workspace`
- `player`
- `operation`
- `global_user_preferences`

### Memory Rule

Dusk should remember enough to be helpful, but not so much that context becomes noisy or creepy.

### Recommended Sources

- recent quests
- active sessions
- self-tree links
- active assistant workspace
- recent notes and templates
- current multiplayer target when relevant

## Provider Architecture

Dusk should be provider-agnostic above the adapter layer.

Recommended provider categories:

```txt
Provider Modes
- local_none
- local_model
- byok_openai
- byok_anthropic
- managed_openai
- future_other
```

### OpenAI Direction

If using OpenAI, Dusk should align with the Responses API and tool-first agent patterns.

Official references:

- [Migrate to the Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses)
- [Using tools](https://developers.openai.com/api/docs/guides/tools)
- [Background mode](https://developers.openai.com/api/docs/guides/background)

Important current signals:

- OpenAI positions the Responses API as the future direction for agent-like apps.
- It supports built-in tools, function calling, remote MCP servers, and multi-step agentic loops.
- The Assistants API is deprecated as of August 26, 2025, with sunset on August 26, 2026.

### Anthropic Direction

If using Anthropic, Dusk should map through Claude's tool use patterns and keep the same internal tool abstraction.

Official reference:

- [Claude tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)

Important signal:

- Claude tool use follows an explicit loop where the model requests a tool, the client executes it, and the result is returned in a follow-up turn.

### Local Model Direction

For local/private or offline-leaning use, Dusk should eventually support local models through a local adapter.

Official references:

- [Ollama API introduction](https://docs.ollama.com/api/introduction)
- [Ollama tool calling](https://docs.ollama.com/capabilities/tool-calling)

Important signal:

- Ollama supports local model serving and tool calling, which makes it a strong candidate for advanced local Dusk later.

### MCP Direction

Dusk should treat MCP as an integration protocol, not as the product itself.

Official reference:

- [Model Context Protocol intro](https://modelcontextprotocol.io/docs/getting-started/intro)

Important signal:

- MCP is an open protocol with broad ecosystem support, which makes it a strong long-term path for Dusk integrations across providers and tools.

## Recommended Provider Strategy

### Phase 1

- local deterministic Dusk
- optional connected OpenAI

### Phase 2

- BYOK OpenAI
- BYOK Anthropic
- remote MCP integrations

### Phase 3

- local model adapter
- advanced provider routing
- workload-specific model selection

## Runtime Patterns

### Fast Path

For quick, low-risk interactions:

- local state lookup
- small prompt or deterministic logic
- instant reply

Examples:

- "what's next?"
- "start this quest"
- "show active session"

### Tool Path

For actions:

- interpret intent
- select approved tool
- validate permissions
- execute tool
- log result

### Background Path

For longer reasoning jobs:

- create run
- queue work
- poll or receive completion
- present result as a brief, draft, or recommendation

This aligns well with current background-task patterns in modern APIs like OpenAI background mode.

## Section Ownership

### Dusk Owns

- assistant persona
- tool orchestration
- provider routing
- memory scoping
- run and audit records

### Dusk Reads

- core domain state
- settings
- lab workspaces
- knowledge docs
- multiplayer targets
- inventory links

### Dusk Does Not Own

- quest truth
- profile truth
- inventory truth
- multiplayer truth
- scene rendering truth

## Current Repo Alignment

Current assistant-related surfaces:

- [HextechAssistant.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/Features/HextechAssistant.tsx#L2250)
- [DuskLayout.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/components/DuskLayout.tsx#L11)

Current interpretation:

- `HextechAssistant` is a useful transition surface for quest/focus interactions
- `DuskLayout` is closer to a visual prototype than a canonical assistant system

Neither should be treated as the final Dusk architecture by themselves.

## UX Rules

### Good Dusk UX

- clear suggestions
- clear action result
- visible permission state
- small, calm surface by default
- rich workspace only when needed

### Bad Dusk UX

- giant default chat surface
- unclear action authority
- hidden background actions
- interruption-heavy behavior
- personality overriding utility

## Monetization Role

Dusk helps define premium value.

### Free

- local Dusk
- basic suggestions
- basic command help

### Pro

- connected Dusk
- advanced assistant workspaces
- deeper reasoning jobs
- premium templates and automations

### BYOK

- user provides provider key
- Xtation provides orchestration and interface

## Security and Audit Rules

Dusk should always support:

- run logging
- tool call logging
- permission checks
- failure visibility
- admin/support inspection with safeguards

This is especially important because Dusk may eventually operate across:

- user data
- notes
- automations
- multiplayer actions
- external provider connections

## Build Order

### Dusk V1

- define provider-agnostic tool system
- define local deterministic Dusk
- add command surface in key sections
- support safe read/suggest/draft flows

### Dusk V2

- connected provider support
- richer Lab workspaces
- background tasks
- Dusk memory scopes

### Dusk V3

- local model support
- remote MCP integrations
- advanced voice and companion flows

## Final Summary

Dusk should become the primary interaction intelligence of Xtation.

It should:

- work offline
- improve every section
- act through explicit tools
- remain permissioned and auditable
- support both local and connected operation

Dusk should feel like:

- one assistant
- many surfaces
- one command layer
- many safe capabilities

That is the correct foundation for making Xtation intelligent without making it chaotic.
