/**
	The Patterns are the raw strings used by the lexer to match tokens.
	These are used primarily by the Markup module, where they are attached to
	lexer rules.
	
	@module Patterns
*/
(function(){
	"use strict";
	var Patterns;
	
	/*
		Escapes characters in a string so that RegExp(str) produces a valid regex.
	*/
	function escape(str) {
		// This function may also accept objects, whereupon it applies itself
		// to every enumerable in the object.
		if (str && typeof str === "object") {
			Object.keys(str).forEach(function(e) {
				str[e] = escape(str[e]);
			});
			return str;
		}
		return (str+"").replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
	}
	
	/*
		Matches a string of non-nesting characters enclosed by open character and another character,
		but potentially containing the close-character escaped with \
		
		For instance, <This is \> an example>.
	*/
	function enclosed(o, c) {
		o = escape(o);
		c = c ? escape(c) : o;

		return o + "(?:" + notChars( c + "\\" ) + "\\\\.)" + "*" + notChars( c + "\\" ) + c;
	}
	
	/*
		A sugar REstring function for negative character sets.
		This escapes its input.
	*/
	function notChars(/* variadic */) {
		return "[^" + Array.apply(0, arguments).map(escape).join("") + "]*";
	}
	
	/*
		Creates sugar functions which put multiple REstrings into parentheses, separated with |,
		thus producing a capturer or a lookahead.
		This does NOT escape its input.
	*/
	function makeWrapper(starter) {
		return function(/* variadic */) {
			return "(" + starter+Array.apply(0, arguments).join("|") + ")";
		};
	}
	
	var either = makeWrapper("?:"),
		notBefore = makeWrapper("?!"),
		before = makeWrapper("?=");
	
	/*
		This builds REstrings for basic formatting syntax like ''bold'' or //italic//,
		in which the opening token is the same as the closing token.
		
		When given 1+ strings, it produces a REstring that matches each.
	*/
	function stylerSyntax(pair, rest /*variadic*/) {
		var left = Array.isArray(pair) ? pair[0] : pair,
			right = (Array.isArray(pair) && pair[1]) || left;
		
		return escape(left) + "([^]*?)" + escape(right) +
			/*
				This function checks if the right-terminator is a sole repeating symbol,
				then returns the symbol wrapped in '(?!' ')', or "" if not.
			*/
			(function fn(str) {
				var s = str.split("").reduce(function(a, b){ return a === b && a; });
				
				return s && notBefore(escape(s));
			}(right))
			// Join with any additional pairs
			+ (rest ? "|" + stylerSyntax.apply(0, Array.apply(0,arguments).slice(1)) : "");
	}
	
	/*
		Opener lookaheads come in two forms: a simple string to match, when
		only one option for the syntax's opening exists, and a RegExp when
		there are multiple options. This function returns the former when
		only one option is passed as an argument, and the latter otherwise
		(performing escaping on the input strings, etc.)
	*/
	function opener(a /*variadic*/) {
		var pattern, options, re;
		
		if (arguments.length > 1) {
			a = Array.apply(0, arguments);
			options = a.map(escape);
			pattern = either.apply(0, options) + notBefore.apply(0, options);
			re = new RegExp(pattern);
			/*
				We stash a "length" expando property on the RegExp denoting
				the length of the longest option. This enables only the smallest
				slice of the input string to be run against it.
			*/
			re.length = a.reduce(function(a,e) { return Math.max(a,e.length); }, 0);
			return re;
		}
		return {
			/*
				This function strives to be as fast as possible.
			*/
			exec: function(input) {
				var i = a.length;
				while(--i >= 0) {
					if (input[i] !== a[i]) {
						return false;
					}
				}
				return true;
			}
		};
	}
	
	var
		// This includes all forms of whitespace except \n and \r
		ws = "[ \\f\\t\\v\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*",
		
		// Mandatory whitespace
		mws = ws.replace("*","+"),
		
		// Word break
		wb = "\\b",
		
		// Checks if text appears before line-breaks or end-of-input.
		eol = "(?=\\n+|$)",
		
		// Handles Unicode ranges not covered by \w. Copied from TiddlyWiki5 source - may need updating.
		anyLetter       = "[\\w\\-\u00c0-\u00de\u00df-\u00ff\u0150\u0170\u0151\u0171]",
		// Identical to the above, but excludes hyphens.
		anyLetterStrict =    "[\\w\u00c0-\u00de\u00df-\u00ff\u0150\u0170\u0151\u0171]",
		
		/*
			This is a regex suffix that, when applied, causes the preceding match to only apply when not inside a quoted
			string. This accounts for both single- and double-quotes, and escaped quote characters.
		*/
		unquoted = before(either( notChars("'\"\\") + either( "\\.", enclosed("'"), enclosed('"'))) + "*" + notChars("'\\") + "$"),
		
		/*
			Markdown lists changes:
			
			* Only the * can be used for bullets (to prevent ambiguity with printed numbers: -2 or +2)
			* Multiples of the bullet must be used for nested lists: **, instead of whitespace.
			* Numbered lists must use 0. instead of actual numbers.
			
			In the field, lists are structurally not that useful in Twine, except for pure
			presentational purposes: putting a bullet-point before a line.
		*/
		bullet = "\\*",
		
		bulleted = "(?:\n|^)" + ws + "(" + bullet + "+)" + mws + "([^\\n]*)" + eol,
		
		numberPoint = "(?:0\\.)",
		
		numbered = "(?:\n|^)" + ws + "(" + numberPoint + "+)" + ws + "([^\\n]*)" + eol,
		
		hr = "(?:\n|^)" + ws + "\-{3,}" + ws + eol,
		
		/*
			Markdown setext headers conflict with the hr syntax, and are thus gone.
		*/
		heading = "\n?" + ws + "(#{1,6})" + ws + "([^\\n]+?)" + ws + "#*" + ws + eol,
		
		/*
			New text alignment syntax.
		*/
		align = ws + "(==+>|<=+|=+><=+|<==+>)" + ws + eol,
		
		passageLink = {
			opener:            "\\[\\[(?!\\[)",
			text:              "(" + notChars("]") + ")",
			rightSeparator:    either("\\->", "\\|"),
			leftSeparator:     "<\\-",
			closer:            "\\]\\]",
			legacySeparator:   "\\|",
			legacyText:        "(" + either("[^\\|\\]]", "\\]" + notBefore("\\]")) + "+)",
		},
		
		/*
			This determines the valid characters for a property name. Sadly, "-" is not allowed.
			As of 1.1, this must include at least 1 non-numeral.
		*/
		validPropertyName =
			anyLetter.replace("\\-", "") + "*"
			+ anyLetter.replace("\\-", "").replace("\\w","a-zA-Z")
			+ anyLetter.replace("\\-", "") + "*",
		
		/*
			Variables, and properties of variables:
			$red
			$bag's bonnet
			$a's 1st's 2nd
		*/
		variable = "\\$(" + validPropertyName + ")",
		
		property = "'s" + mws + "(" + validPropertyName + ")",
		
		belongingProperty = "(" + validPropertyName + ")" + mws + "of" + wb + notBefore("it" + wb),
		
		/*
			Computed properties are of the form:
			$a's (expression)
			or
			(expression) of $a
		*/
		possessiveOperator = "'s" + mws,
		
		/*
			Computed properties are of the form:
			$a's (expression)
		*/
		belongingOperator = "of" + wb,
		
		/*
			Identifiers: either "it" or "time".
			"it" is a bit of a problem because its possessive is "its", not "it's",
			so we can't use a derivation similar to property.
		*/
		identifier = either("it","time") + wb,
		
		itsProperty = "its" + mws + "(" + validPropertyName + ")",
		
		itsOperator = "its" + mws,
		
		belongingItProperty = "(" + validPropertyName + ")" + mws + "of" + mws + "it" + wb,
		
		belongingItOperator = "of" + wb + mws + "it" + wb,
		
		macro = {
			opener:            "\\(",
			name:              "(" + either(anyLetter.replace("]","\\/]") + anyLetter + "*", variable) + "):",
			closer:            "\\)",
		},
		
		twine1Macro = "<<[^>\\s]+\\s*(?:\\\\.|'(?:[^'\\\\]*\\\\.)*[^'\\\\]*'|\"(?:[^\"\\\\]*\\\\.)*[^\"\\\\]*\"|[^'\"\\\\>]|>(?!>))*>>",
		
		tag = {
			name:              "\\w[\\w\\-]*",
			attrs:             "(?:\"[^\"]*\"|'[^']*'|[^'\">])*?",
		},
		
		hookTagFront =  "\\|(" + anyLetter.replace("]", "_]") + "*)>",
		hookTagBack  =  "<("   + anyLetter.replace("]", "_]") + "*)\\|",
		
		string = {
			/*
				Notice that no empty string is permitted - this can only be produced
				using (text:) with no arguments.
			*/
			single:   enclosed("'"),
			double:   enclosed('"'),
		},
		
		/*
			This includes NaN, but I wonder if it should.
			This doesn't include the - sign because arithmetic's pattern will trump it.
			Negative numerals are handled in TwineScript as unary uses of arithmetic.
		*/
		number = '\\b(\\d+(?:\\.\\d+)?(?:[eE][+\\-]?\\d+)?|NaN)' + notBefore("m?s") + '\\b'
		;
	
	passageLink.main =
		passageLink.opener
		+ either(
			passageLink.text + passageLink.rightSeparator,
			/*
				The rightmost right arrow or leftmost left arrow
				is regarded as the canonical separator.
			
				[[A->B->C->D->E]] has a link text of
					A->B->C->D
					and a passage name of
					E
			
				[[A<-B<-C<-D<-E]] has a link text of
					B<-C<-D<-E
					and a passage name of
					A
			
				Thus, the left separator's preceding text must be non-greedy.
			*/
			passageLink.text.replace("*","*?") + passageLink.leftSeparator
		)
		+ passageLink.text;
	
	/*
		Return the Patterns object.
		
		Note that some of these properties are "opener" objects, which are used by the
		lexer. It's a bit #awkward having them alongside the string properties like this,
		keyed to a similar but otherwise disconnected property name...
	*/
	Patterns = {
		
		upperLetter: "[A-Z\u00c0-\u00de\u0150\u0170]",
		lowerLetter: "[a-z0-9_\\-\u00df-\u00ff\u0151\u0171]",
		anyLetter:   anyLetter,
		anyLetterStrict: anyLetterStrict,
		
		whitespace:  mws,
		unquoted:    unquoted,
		escapedLine: "\\\\\\n",
		
		br: "\\n",
		
		/*
			Twine currently just uses HTML comment syntax for comments.
		*/
		comment:         "<!--[^]*?-->",
		commentOpener:   opener("<!--"),
		
		tag:         "<\\/?" + tag.name + tag.attrs + ">",
		tagOpener:                            opener("<"),
		
		scriptStyleTag: "<(" + either("script","style")
			+ ")" + tag.attrs + ">"
			+ "[^]*?" + "<\\/\\1>",
		
		scriptStyleTagOpener: opener("<"),
		
		url:         "(" + either("https?","mailto","javascript","ftp","data") + ":\\/\\/[^\\s<]+[^<.,:;\"')\\]\\s])",
		
		bullet:      bullet,
		
		hr:          hr,
		heading:     heading,
		align:       align,
		
		strong:          stylerSyntax("**"),
		strongOpener:          opener("**"),
		
		em:               stylerSyntax("*"),
		emOpener:               opener("*"),
		
		del:                   stylerSyntax("~~"),
		delOpener:                   opener("~~"),
		
		italic:                stylerSyntax("//"),
		italicOpener:                opener("//"),
		
		bold:                  stylerSyntax("''"),
		boldOpener:                  opener("''"),
		
		sup:                   stylerSyntax("^^"),
		supOpener:                   opener("^^"),
		
		/*
			The verbatim syntax does not "nest", but terminals can be
			differentiated by adding more ` marks to each pair.
		*/
		verbatim:        "(`+)" + ws + "([^]*?[^`])" + ws + "\\1(?!`)",
		verbatimOpener:                                    opener("`"),
		
		collapsedFront:                                            "{",
		collapsedBack:                                             "}",
		collapsedOpener:                                   opener("{"),
		
		bulleted:    bulleted,
		numbered:    numbered,
		
		/*
			Hook tags can be either prepended, pointing to the right,
				|tag>[The hook's text]
			or appended, pointing to the left.
				[The hook's text]<tag|
		*/
		hookAppendedFront:  "\\[",
		hookPrependedFront:
			hookTagFront + "\\[",
		/*
			The anonymous hook is a contextual production: it may only occur
			after macros and variables. Similarly, the hookAppendedFront
			may NOT occur after macros and variables. The reason these rules are
			not united is because their names are used to identify them in Lexer.
		*/
		hookAnonymousFront: "\\[",
		hookBack:  "\\]" + notBefore(hookTagBack),
		
		hookAppendedBack:
			"\\]" + hookTagBack,
		
		passageLink:
			passageLink.main
			+ passageLink.closer,
			
		passageLinkOpener: opener("[["),
			
		legacyLink:
			/*
				[[A|B]] has a link text of
					A
					and a passage name of
					B
				
				This isn't preferred because it's the reverse of MediaWiki's links.
			*/
			passageLink.opener
			+ passageLink.legacyText + passageLink.legacySeparator
			+ passageLink.legacyText + passageLink.closer,
		
		legacyLinkOpener: opener("[["),
		
		simpleLink:
			/*
				As long as legacyLink remains in the grammar,
				use legacyText here to disambiguate.
			*/
			passageLink.opener + passageLink.legacyText + passageLink.closer,
		
		simpleLinkOpener: opener("[["),
		
		macroFront: macro.opener + before(macro.name),
		macroName: macro.name,
		
		/*
			This must be differentiated from macroFront.
		*/
		groupingFront: "\\(" + notBefore(macro.name),
		
		groupingBack:  "\\)",
		
		twine1Macro:
			twine1Macro,
			
		twine1MacroOpener:
			opener("<<"),
		
		/*
			Macro code
		*/
		
		property:
			property,
		
		belongingProperty:
			belongingProperty,
		
		possessiveOperator:
			possessiveOperator,
		
		belongingOperator:
			belongingOperator,
		
		itsOperator:
			itsOperator,
		
		belongingItOperator:
			belongingItOperator,
		
		variable:
			variable,
		
		hookRef: "\\?(" + anyLetter + "+)\\b",
		
		hookRefOpener:
			opener("?"),
		
		/*
			Artificial types (non-JS primitives)
		*/
		
		cssTime: "(\\d+\\.?\\d*|\\d*\\.?\\d+)(m?s)" + wb,
		
		colour: either(
			// Hue name
			either(
				"Red", "Orange", "Yellow", "Lime", "Green",
				"Cyan", "Aqua", "Blue", "Navy", "Purple",
				"Fuchsia", "Magenta","White", "Gray", "Grey", "Black"
			),
			// Hexadecimal
			"#[\\dA-Fa-f]{3}(?:[\\dA-Fa-f]{3})?"
		),
		
		/*
			Natural types
		*/
		number: number,
		
		boolean: either("true","false") + wb,
		
		// Special identifiers
		identifier: identifier,
		itsProperty: itsProperty,
		belongingItProperty: belongingItProperty,
		
		string:
			either(
				string.single,
				string.double
			),
		
		/*
			Macro operators
		*/
		
		is:        "is" + notBefore(" not", " in") + wb,
		isNot:     "is not" + wb,
		
		and:       "and" + wb,
		or:        "or"  + wb,
		not:       "not" + wb,
		
		inequality: either("<(?!=)", "<=", ">(?!=)", ">="),
		
		isIn:       "is in" + wb,
		contains:   "contains" + wb,

		arithmetic: either("\\+", "\\-", "\\*", "\\\/", "%") + notBefore("="),
		comma:      ",",
		spread:     "\\.\\.\\." + notBefore("\\."),

		to:        either("to" + wb, "="),
		into:      "into" + wb,
		augmentedAssign: either("\\+", "\\-", "\\*", "\\\/", "%") + "=",
	};
	
	if(typeof module === 'object') {
		module.exports = Patterns;
	}
	else if(typeof define === 'function' && define.amd) {
		define('patterns', [], function () {
			return Patterns;
		});
	}
	else {
		this.Patterns = Patterns;
	}
}).call(this || (typeof global !== 'undefined' ? global : window));
