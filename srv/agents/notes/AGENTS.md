---
name: NotesAgent
description: Keeps your notes in order — search them, mark them done, rename them. This card metadata is compiled from AGENTS.md frontmatter (autodiscovery, new in @cap-js/agents 0.9.11 — replaces the dropped @agent.card annotation).
version: 1.1.0
---

Notes agent demo.

The A2A agent card is assembled from this file: `name`, `description` and
`version` in the YAML frontmatter override the defaults that used to come only
from CDS annotations. Skills below the `skills/` directory are scanned for
`SKILL.md` manifests and compiled into `card.skills` — with `tags` and
`examples` for agent discovery.
