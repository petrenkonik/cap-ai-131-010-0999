using { demo } from '../db/schema';

/**
 * Sub-agent: NotesAgent discovers it on its own. With the plugin default
 * `agents.connect: "auto"` every other service annotated with @agent or @mcp
 * becomes a tool of the main agent (A2A delegation / MCP tools).
 */
@agent: true
// a sub-agent must not auto-connect back to NotesAgent (infinite delegation loop)
@agent.connect: 'none'
@description: 'Reviews the notes: reports which ones are finished and which are still open. Read-only.'
@requires: 'authenticated-user'
service ReviewAgent @(path: '/agents/review') {
  @readonly entity Notes as projection on demo.Notes;

  /** Count the notes that are already done. */
  function doneCount() returns Integer;
}

/** MCP service: its read-only entity and function are exposed as MCP tools. */
@mcp: true
@requires: 'authenticated-user'
service NotesStats @(path: '/mcp/notes-stats') {
  @readonly entity Notes as projection on demo.Notes { ID, title, done };

  /** Total number of notes. */
  function totalCount() returns Integer;
}
