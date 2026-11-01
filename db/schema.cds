using { cuid, managed } from '@sap/cds/common';

namespace demo;

entity Notes : cuid, managed {
  title : String(200) @mandatory;
  done  : Boolean default false;
}
