using { cuid, managed } from '@sap/cds/common';

namespace demo;

entity Notes : cuid, managed {
  title : String(200) @mandatory;
  done  : Boolean default false;
}

/**
 * Demo for @cap-js/db-service 3.2.0 (2026-11-11): expand/EXISTS filters now use
 * LEFT OUTER JOINs, so rows survive OR predicates over nullable assoc paths.
 */
entity Editors : cuid {
  name : String(100);
}

entity Books : cuid {
  title  : String(200);
  genre  : Association to Genres;
  editor : Association to Editors;   // nullable — the null path in the demo filter
}

entity Genres : cuid {
  name  : String(100);
  // backlink via the element's own name (`on Books.genre = $self` no longer
  // resolves in the CQL parser shipped with @sap/cds 10.2.x)
  books : Association to many Books on books.genre = $self;
}
