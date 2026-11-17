// Development only: refresh the page when the server reports a change (see server.js).
(function () {
  'use strict';
  var es = new EventSource('/__dev/reload');
  es.onmessage = function () { location.reload(); };
})();
