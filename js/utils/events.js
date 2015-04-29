define([], function() {
  "use strict";
  /*
     Static namespace with custom events that get triggered on Selectors.story
  */
  return Object.freeze({
    afterShowPassage: "afterShowPassage",
    beforeShowPassage: "beforeShowPassage",
  });
});
