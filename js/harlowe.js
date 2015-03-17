/*
	This require.config call must be in here, so that local testing of Harlowe
	can be conducted without having to recompile harlowe.min.js.
*/
require.config({
	paths: {
		// External libraries
		jquery:          '../node_modules/jquery/dist/jquery',
		"lz-string":     '../node_modules/lz-string/libs/lz-string-1.3.3',
		almond:          '../node_modules/almond/almond',
		"es6-shim":      '../node_modules/es6-shim/es6-shim',
		jqueryplugins:   'utils/jqueryplugins',
		
		markup:          './markup/markup',
		lexer:           './markup/lexer',
		patterns:        './markup/patterns',
	},
	deps: [
		'jquery',
		'es6-shim',
		'jqueryplugins',
	],
});
require(['jquery', 'renderer', 'state', 'engine', 'utils', 'utils/selectors', 'macrolib', 'repl'],
		function ($, Renderer, State, Engine, Utils, Selectors) {
	"use strict";
	/**
		Harlowe, the default story format for Twine 2.
		
		This module contains only code which initialises the document and the game.
		
		@module Harlowe
		@main Harlowe
	*/
	
	// Used to execute custom scripts outside of main()'s scope.
	function _eval(text) {
		return eval(text + '');
	}
	
	/**
		Sets up event handlers for specific Twine elements. This should only be called
		once at setup.

		@method installHandlers
	*/
	var installHandlers = function() {
		var html = $(document.documentElement),
			debugHTML =
			"<tw-debugger><button class='show-invisibles'>&#9903; Debug View</button></tw-debugger>";
		
		/*
			This gives interactable elements that should have keyboard access (via possessing
			a tabindex property) some basic keyboard accessibility, by making their
			enter-key event trigger their click event.
		*/
		html.on('keydown', function(event) {
			if (event.which === 13 && event.target.getAttribute('tabindex') === "0") {
				$(event.target).trigger('click');
			}
		});
		
		// If the debug option is on, add the debugger.
		if (Engine.options.debug) {
			$(document.body).append(debugHTML);
			$('.show-invisibles').click(function() {
				html.toggleClass('debug-mode').is(".debug-mode");
			});
		}
		installHandlers = null;
	};

	/*
		This is the main function which starts up the entire program.
	*/
	$(document).ready(function main() {
		var header = $(Selectors.storyData),
			options,
			startPassage,
			script = $(Selectors.script),
			stylesheet = $(Selectors.stylesheet);

		if (header.length === 0) {
			return;
		}

		// Load options from attribute into story object

		options = header.attr('options');

		if (options) {
			options.split(/\s/).forEach(function(b) {
				Renderer.options[b] = Engine.options[b] = true;
			});
		}
		startPassage = header.attr('startnode');
		
		// If there's no set start passage, find the passage with the
		// lowest passage ID, and use that.
		if (!startPassage) {
			startPassage = [].reduce.call($(Selectors.passageData), function(id, el) {
				var pid = el.getAttribute('pid');
				return (pid < id ? pid : id);
			}, Infinity);
		}
		startPassage = $(Selectors.passageData + "[pid=" + startPassage + "]").attr('name');

		// Init game engine

		installHandlers();
		
		// Execute the custom scripts
		
		script.each(function(i) {
			try {
				_eval($(this).html());
			} catch (e) {
				// TODO: Something more graceful - an 'error passage', perhaps?
				alert("There is a problem with this story's script (#" + (i + 1) + "):\n\n" + e.message);
			}
		});
		
		// Apply the stylesheets
		
		stylesheet.each(function(i) {
			// In the future, pre-processing may occur.
			$(document.head).append('<style data-title="Story stylesheet ' + (i + 1) + '">' + $(this).html());
		});
		
		// Load the hash if it's present
		if (window.location.hash && !window.location.hash.includes("stories")) {
			if (State.load(window.location.hash)) {
				Engine.showPassage(State.passage);
				return;
			}
		}
		// Show first passage!
		Engine.goToPassage(startPassage);
	});
});
