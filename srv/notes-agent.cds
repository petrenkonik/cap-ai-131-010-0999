using { demo } from '../db/schema';

/** A2A agent over the demo Notes model — tools are generated from this service. */
@agent: true
@description: 'Demo agent managing notes. Runs on the built-in llm-mock provider — no API key needed.'
service NotesAgent @(path: '/agents/notes') {
  entity Notes as projection on demo.Notes;

  /** Mark a note as done. */
  action complete(ID: UUID) returns Boolean;
}
