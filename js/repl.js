define(['utils', 'markup', 'twinescript/compiler', 'twinescript/environ'], function(Utils, TwineMarkup, Compiler, Environ) {
	"use strict";
	/*
		REPL
		These are debugging functions, used in the browser console to inspect the output of
		TwineMarkup and the TwineScript compiler.
	*/
	window.REPL = function(a) {
	  var r = Compiler(TwineMarkup.lex("(print:" + a + ")"));
	  console.log(r);
	  return Environ({}).eval(r);
	};
	window.LEX = function(a) {
	  var r = TwineMarkup.lex(a);
	  return (r.length === 1 ? r[0] : r);
	};
});
