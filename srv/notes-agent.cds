using { demo } from '../db/schema';

/** A2A agent over the demo Notes model — tools are generated from this service. */
@agent: true
@description: 'Demo agent managing notes. Runs on the built-in llm-mock provider locally (AI Core in production).'
@requires: 'authenticated-user'
service NotesAgent @(path: '/agents/notes') {
  entity Notes as projection on demo.Notes;

  /** Mark a note as done. */
  @agent.hitl action complete(ID: UUID) returns Boolean;

  /** Count the notes that are still open (not done yet). */
  function openCount() returns Integer;

  /** Change the title of a note. */
  action rename(ID: UUID, title: String(200)) returns Boolean;
}
