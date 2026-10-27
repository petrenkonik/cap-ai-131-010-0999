namespace demo;

entity Notes {
  key ID    : UUID;
      title : String;
      done  : Boolean default false;
}
