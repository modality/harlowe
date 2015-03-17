module.exports = function(grunt) {
	'use strict';
	/*
		This generates end-user Harlowe macro and syntax documentation (in Markup) by reading
		/*d: delimited comments from the source file.
	*/
	var
		macroEmpty = /\(([\w\-\d]+):\)(?!`)/g,
		macroWithTypeSignature = /\(([\w\-\d]+):([\s\w\.\,\[\]]*)\) -> ([\w]+)/,
		/*
			This matches a mixed-case type name, optionally plural, but not whenever
			it seems to be part of a macro name.
		*/
		typeName = /\b(variabletovalue|any|nothing|command|string|number|boolean|array|data(?:map|set))(s?)(?!\:\))\b/ig,
		typeDefinition = /([\w]+) data\n/,
		
		// Type definitions
		typeDefs = {},
		// Macro definitions
		macroDefs = {},
		// Error definitions
		errorDefs = {};
	
	/*
		Write out a parameter signature, highlighting the pertinent parts:
		* Type names
		* "Optional" brackets
		* "Rest" ellipsis
		...with relevant HTML.
	*/
	function parameterSignature(sig) {
		return sig
			// Highlight the optional syntax
			.replace(/([\[\]])/g,  "<span class=parameter_optional>$1</span>")
			// Highlight the rest syntax
			.replace(/\.{3}/g, "<span class=parameter_rest>...</span>");
	}
	
	/*
		Write out the macro's signature as the following structures:
		* A <h2> tag anchored to "macro_" + the macro's name.
		* The macro's tag, containing...
		* Its parameter signature.
		* Then, afterward, a return type signature.
	*/
	function macroSignature(name, sig, returnType) {
		return "\n<h2 id=macro_" + name.toLowerCase() + ">" +
			"(" + name + ": <i>" +
			parameterSignature(sig) +
			"</i>) <span class=macro_returntype>&rarr;</span> <i>" +
			returnType +
			"</i></h2>\n";
	}
	
	/*
		Convert various structures or terms in the passed-in body text
		into hyperlinks to their definitions, etc.
		(But don't link terms more than once, or link the title term.)
	*/
	function processTextTerms(text, match) {
		/*
			A record of which type names were hyperlinked.
			As a rule, only hyperlink type names once each per definition.
		*/
		var typeNamesLinked = [],
			title = match[1];
		
		text = text
			/*
				Convert type names into hyperlinks.
			*/
			.replace(typeName, function(text, $1, $2){
				/*
					...but don't hyperlink references to this own type.
					(This targets mixed-case singular and plural.)
				*/
				if ($1.toLowerCase() === title.toLowerCase()) {
					return text;
				}
				if (typeNamesLinked.indexOf($1) === -1) {
					typeNamesLinked.push($1);
					return "[" + $1 + $2 + "](#type_" + $1.toLowerCase() + ")";
				}
				return text;
			})
			/*
				Convert other macro definitions into hyperlinks.
			*/
			.replace(macroEmpty, function(text, $1) {
				/*
					...but don't hyperlink references to this own macro.
					(e.g. don't hyperlink (goto:) in the (goto:) article.)
				*/
				if ($1.toLowerCase() === match[1].toLowerCase()) {
					return "<b>" + text + "</b>";
				}
				return "[(" + $1 + ":)](#macro_" + $1.toLowerCase() + ")";
			})
			/*
				Convert the minor headings into <h4> elements.
			*/
			.replace(/\n([A-Z][\w\s\d]+:)\n/g,"\n####$1\n");
		return text;
	}
	
	function processMacroDefinition(match) {
		var title = match[0];
		var text = match.input.trim()
			/*
				Convert the title signature into an anchor and an augmented parameter signature.
			*/
			.replace(title,macroSignature(match[1], match[2], match[3]));
		
		text = processTextTerms(text, match);
		
		/*
			Now, do it! Output the text!
		*/
		macroDefs[title] = text;
		console.log('Macro: ' + title);
	}
	
	function processTypeDefinition(match) {
		var title = match[0],
			text = processTextTerms(
				match.input.trim().replace(match[0], "\n<h2 id=type_" + match[1].toLowerCase() + ">" + match[0] + "</h2>\n"),
				match
			);
		typeDefs[title] = text;
		console.log('Datatype: ' + title.trim());
	}
	
	grunt.registerTask('harlowedocs', "Make Harlowe documentation", function() {
		/*
			Read the definitions from every JS file.
		*/
		grunt.file.recurse('js/', function(path) {
			var defs = grunt.file.read(path).match(/\/\*d:[^]*?\*\//g);
			if (!defs) {
				return;
			}
			defs.map(function(e) {
				
				// Remove the /*d: and */ markers, whitespace, and tabs.
				return e.replace(/\t/g,'').slice(4,-2).trim();
				
			}).forEach(function(defText) {
				var match;
				/*
					Is it a macro definition?
				*/
				if ((match = defText.match(macroWithTypeSignature))) {
					processMacroDefinition(match);
				}
				/*
					Is it a type definition?
				*/
				if ((match = defText.match(typeDefinition))) {
					processTypeDefinition(match);
				}
			});
		});
		/*
			Now, output the file.
		*/
		var outputFile = "";
		/*
			Output macro definitions.
		*/
		outputFile += "\n<h1 id=section_types>Types of data</h1>\n";
		Object.keys(typeDefs).sort().forEach(function(e) {
			outputFile += typeDefs[e];
		});
		outputFile += "\n<h1 id=section_macros>List of macros</h1>\n";
		Object.keys(macroDefs).sort().forEach(function(e) {
			outputFile += macroDefs[e];
		});
		grunt.file.write("dist/harloweDocs.md", outputFile);
	});
};
