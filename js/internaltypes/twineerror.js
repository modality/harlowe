define(['jquery', 'utils'], function($, Utils) {
	"use strict";
	/*
		TwineErrors are errors created by the TwineScript runtime. They are supplied with as much
		information as they can, in order to give the author sufficient assistance in
		understanding the error.
	*/
	
	/*
		This dictionary supplies extra explanations for the error types.
	*/
	var errorExplanations = {
		saving: "I tried to save or load the game, but I couldn't do it.",
		operation: "I tried to use an operation on some data, but the data's type was incorrect.",
		macrocall: "I tried to use a macro, but its call wasn't written correctly.",
		datatype: "I tried to use a macro, but was given the wrong type of data to it.",
		keyword: "I was given a keyword in a way that I didn't understand.",
		property: "I tried to access a value in a string/array/datamap, but I couldn't find it.",
		unimplemented: "I currently don't have this particular feature. I'm sorry.",
		javascript: "This error message was reported by your browser's Javascript engine. "
			+ "I don't understand it either, but it usually means that an expression was badly written.",
	},
	
	TwineError = {
		
		create: function(type, message) {
			if (!message) {
				Utils.impossible("TwineError.create", "called with only 1 string.");
			}
			return Object.assign(Object.create(this), {
				/*
					The type of the TwineError consists of one of the following strings:
					"property" - used for accessing an incorrect property.
					"operation" - used for applying incorrect operations to certain data.
					"macrocall" - used for macro call errors, such as parameter length.
					"datatype" - used for macro parameter type errors
					"unimplemented" - when a feature isn't available
					"javascript" - should only 
				*/
				type: type,
				message: message
			});
		},
	
		/*
			This utility function converts a Javascript Error into a TwineError.
			This allows them to be render()ed by Section.
			
			Javascript error messages are presaged with a coffee cup (\u2615),
			to signify that the browser produced them and not Twine.
		*/
		fromError: function(error) {
			return TwineError.create("javascript", "\u2615 " + error.message);
		},
		
		/**
			In TwineScript, both the runtime (operations.js) and Javascript eval()
			of compiled code (by compiler.js) can throw errors. They should be treated
			as equivalent within the engine.
			
			If the arguments contain a native Error, this will return that error.
			Or, if it contains a TwineError, return that as well.
			This also recursively examines arrays' contents.

			Maybe in the future, there could be a way to concatenate multiple
			errors into a single "report"...

			@method containsError
			@return {Error|TwineError|Boolean} The first error encountered, or false.
		*/
		containsError: function containsError(/*variadic*/) {
			return Array.from(arguments).reduce(
				function(last, e) {
					return last ? last
						: e instanceof Error ? e
						: TwineError.isPrototypeOf(e) ? e
						: Array.isArray(e) ? containsError.apply(this, e)
						: false;
				}, false);
		},
		
		/*
			Twine warnings are just errors with a special "warning" bit.
		*/
		createWarning: function(type, message) {
			return Object.assign(this.create(type, message), {
				warning: true,
			});
		},
		
		render: function(titleText) {
			/*
				Default the titleText value. It may be undefined if, for instance, debug mode is off.
			*/
			titleText = titleText || "";
			var errorElement = $("<tw-error class='"
					+ (this.type === "javascript" ? "javascript ": "")
					+ (this.warning ? "warning" : "error")
					+ "' title='" + Utils.escape(titleText) + "'>" + Utils.escape(this.message) + "</tw-error>"),
				/*
					The explanation text element.
				*/
				explanationElement = $("<tw-error-explanation>")
					.text(errorExplanations[this.type])
					.hide(),
				/*
					The button to reveal the explanation consists of a rightward arrowhead
					which is rotated when the explanation is unfolded down.
				*/
				explanationButton = $("<tw-error-explanation-button tabindex=0>")
					/*
						The arrowhead must be in its own <span> so that it can be rotated.
						The CSS class "folddown-arrowhead" is used exclusively for this kind of thing.
					*/
					.html("<span class='folddown-arrowhead'>&#9658;</span>");
					
			/*
				Wire up the explanation button to reveal the error explanation.
			*/
			explanationButton.on('click', function() {
				explanationElement.toggle();
				explanationButton.children(".folddown-arrowhead").css(
					'transform',
					'rotate(' + (explanationElement.is(':visible') ? '90deg' : '0deg') + ')'
				);
			});
			
			errorElement.append(explanationButton).append(explanationElement);
			
			return errorElement;
		},
	};
	return TwineError;
});
