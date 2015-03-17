define([
	'utils',
	'macrolib/values',
	'macrolib/commands',
	'macrolib/datastructures',
	'macrolib/stylechangers',
	'macrolib/enchantments',
	'macrolib/links',
],
function(Utils) {
	"use strict";
	/*
		Twine macro standard library.
		Modifies the Macros module only. Exports nothing.
		
		Most of the built-in macros are in the categorised submodules.
		The macros that remain in here are uncategorised at present.
		
		
		MACRO NAMING CONVENTIONS:
		
		* Generally stick to single words as much as possible,
			but take pains to make the word as relevant and precise as possible.
		* "on"  prefix: Currently reserved.
		* "at"  prefix: Currently reserved.
		* "is"  prefix: Currently reserved.
		* "can" prefix: Currently reserved.
		* type name: Should denote a type constructor or converter.
			Constructors include (colour:), (text:) and (num:)
		* verbs:
			Should be saved for commands only.
	*/
	
	Utils.log("Loaded the built-in macros.");
});
