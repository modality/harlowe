/**
	TwineMarkup, by Leon Arnott.
	This module, alongside the Patterns module, defines the standard syntax of Harlowe.
	
	@module TwineMarkup
*/
(function () {
	"use strict";
	
	var Patterns;
	
	/**
		When passed a Lexer object, this function augments it with rules.
	*/
	function rules(Lexer) {
		var
			/*
				These objects contain each ordered category of rules.
				(blockRules and inlineRules are currently only differentiated
				for categorisation purposes - they are both equally usable in
				Markup Mode.)
			*/
			blockRules,
			inlineRules,
			expressionRules,
			macroRules,
			// ..and, this is the union of them.
			allRules,
			/*
				Modes determine which rules are applicable when. They are (or will be)
				arrays of string keys of the allRules object.
			*/
			/*
				The standard TwineMarkup mode.
			*/
			markupMode     = [],
			/*
				The contents of macro tags - expressions and other macros.
			*/
			macroMode    = [];
		
		/*
			Creates a function that pushes a token with innerText;
			designed for styling rules like **strong** or //italic//.
			
			If given a second parameter, that is used as the property name
			instead of "innerText"
		*/
		function textTokenFn(name) {
			name = name || "innerText";
			return function(match) {
				/*
					This function returns the rightmost non-zero array-indexed value.
					It's designed for matches created from regexes that only have 1 group.
				*/
				var innerText = match.reduceRight(function(a, b, index) { return a || (index ? b : ""); }, ""),
					data = {};
				
				data[name] = innerText;
				
				return data;
			};
		}

		/*
			Alters the rules object's fn methods, so that their returned objects
			have 'type', 'match' and 'innerMode' properties assigned to them.
		*/
		function setupRules(mode, target) {
			// This uses a for-in loop for some reason.
			Object.keys(target).forEach(function(ruleName) {
				target[ruleName].fn = function(innerFn, match) {
					var ret = innerFn(match);
					/*
						Attach the match object, if it isn't already.
					*/
					if (!ret.match) {
						ret.match = match;
					}
					/*
						Give the returned data a type if it didn't
						already have one. Only a few rules have a type which
						varies from the name of the rule (passageLink, for one.)
					*/
					if (!ret.type) {
						ret.type = ruleName;
					}
					/*
						The mode of a token is determined solely by
						which category of rules it is in.
					*/
					if (!ret.innerMode) {
						ret.innerMode = mode;
					}
					return ret;
				}.bind(target[ruleName], target[ruleName].fn);
			});
			return target;
		}
		
		blockRules = setupRules(markupMode, {
			/*
				First, the block rules.
			*/
			hr: {
				fn: Object,
				canFollow: [null, "br"],
			},
			bulleted: {
				fn: function(match) {
					return {
						depth: match[1].length,
						innerText: match[2]
					};
				},
				canFollow: [null, "br"],
			},
			numbered: {
				fn: function(match) {
					return {
						depth: match[1].length / 2,
						innerText: match[2]
					};
				},
				canFollow: [null, "br"],
			},
			heading: {
				fn: function(match) {
					return {
						depth: match[1].length,
						innerText: match[2]
					};
				},
				canFollow: [null, "br"],
			},
			/*
				Text align syntax
				
				==>      : right-aligned
				=><=     : centered
				<==>     : justified
				<==      : left-aligned (undoes the above)
				===><=   : margins 3/4 left, 1/4 right
				=><===== : margins 1/6 left, 5/6 right, etc.
			*/
			align: {
				fn: function (match) {
					var align,
						arrow = match[1],
						centerIndex = arrow.indexOf("><");
						
					if (~centerIndex) {
						/*
							Find the left-align value
							(Since offset-centered text is centered,
							halve the left-align - hence I multiply by 50 instead of 100
							to convert to a percentage.)
						*/
						align = Math.round(centerIndex / (arrow.length - 2) * 50);
						if (align === 25) {
							align = "center";
						}
					} else if (arrow[0] === "<" && arrow.slice(-1) === ">") {
						align = "justify";
					} else if (arrow.includes(">")) {
						align = "right";
					} else if (arrow.includes("<")) {
						align = "left";
					}
					return { align: align };
				},
			},
		});
		
		/*
			Now, the inline rules.
		*/
		inlineRules = setupRules(markupMode, {
		
			/*
				This is a legacy match that simply provides
				an error to those who have mistakenly deployed Twine 1
				macro syntax in Twine 2.
			*/
			twine1Macro: { fn: Object },
			
			/*
				Like GitHub-Flavoured Markdown, Twine preserves line breaks
				within paragraphs.
			*/
			br:      { fn:        Object },
			
			strong:  { fn: textTokenFn() },
			em:      { fn: textTokenFn() },
			bold:    { fn: textTokenFn() },
			italic:  { fn: textTokenFn() },
			del:     { fn: textTokenFn() },
			sup:     { fn: textTokenFn() },
			
			comment: { fn:        Object },
			// This must come before the generic tag rule
			scriptStyleTag: { fn:        Object },
			tag:     { fn:        Object },
			url:     { fn:        Object },
			
			passageLink: {
				fn: function(match) {
					var p1 = match[1],
						p2 = match[2],
						p3 = match[3];
					
					return {
						type: "twineLink",
						innerText: p2 ? p3 : p1,
						passage:   p1 ? p3 : p2,
					};
				},
			},
			
			simpleLink: {
				fn: function(match) {
					return {
						type: "twineLink",
						innerText: match[1],
						passage:   match[1],
					};
				},
			},
			
			hookPrependedFront: {
				fn: function(match) {
					return {
						name: match[1],
						tagPosition: "prepended"
					};
				},
			},
			
			hookAnonymousFront: {
				fn: Object,
				canFollow: ["macro", "variable"],
			},
			
			hookAppendedFront: {
				fn: Object,
				/*
					Because hookAnonymousFront's and hookAppendedFront's
					rules are identical, the canFollow of one must match
					the cannotFollow of the other.
				*/
				cannotFollow: ["macro", "variable"],
			},
			
			hookBack: {
				fn: function() {
					return {
						type: "hookAppendedBack",
						matches: {
							// Matching front token : Name of complete token
							hookPrependedFront: "hook",
							hookAnonymousFront: "hook",
						},
					};
				},
			},
			
			hookAppendedBack: {
				fn: function(match) {
					return {
						name: match[1],
						tagPosition: "appended",
						matches: {
							hookAppendedFront: "hook",
						},
					};
				},
			},
			
			verbatim: {
				fn: function(match) {
					return {
						verbatim: match[2]
					};
				},
			},
			collapsedFront: {
				fn: Object,
			},
			collapsedBack: {
				fn: function() {
					return {
						type: "collapsedBack",
						matches: {
							collapsedFront: "collapsed",
						},
					};
				},
			},
			escapedLine: {
				fn: Object
			},
			legacyLink: {
				fn: function(match) {
					return {
						type: "twineLink",
						innerText: match[1],
						passage: match[2]
					};
				},
			},
		});
		
		/*
			Expression rules.
		*/
		expressionRules = setupRules(macroMode, {
			macroFront: {
				fn: function(match) {
					return {
						name: match[1],
					};
				},
			},
			groupingBack: {
				fn: function() {
					return {
						matches: {
							groupingFront:
								"grouping",
							macroFront:
								"macro",
						},
					};
				},
			},
			
			hookRef:  { fn: textTokenFn("name") },
			
			variable:   { fn: textTokenFn("name") },
			
			whitespace: { fn: Object },
		});
		
		/*
			Now, macro code rules.
		*/
		macroRules = setupRules(macroMode, Object.assign({
				/*
					The macroName must be a separate token, because it could
					be a method call (which in itself contains a variable token
					and 0+ property tokens).
				*/
				macroName: {
					// This must be the first token inside a macro.
					canFollow: [null],
					fn: function(match) {
						/*
							If match[2] is present, then it matched a variable.
							Thus, it's a method call.
						*/
						if (match[2]) {
							return {
								isMethodCall:   true,
								innerText:      match[2],
							};
						}
						return { isMethodCall:   false };
					},
				},
				
				groupingFront: { fn: Object },
				
				/*
					Warning: the property pattern "'s" conflicts with the string literal
					pattern - "$a's b's" resembles a string literal. To ensure that
					the former is always matched first, this rule must come before it.
				*/
				property: {
					fn: textTokenFn("name"),
					canFollow: ["variable", "hookRef", "property",
						"itsProperty", "belongingItProperty", "macro", "grouping", "string"],
				},
				
				possessiveOperator: { fn: Object },
				
				itsProperty:         { fn: textTokenFn("name") },
				
				itsOperator: { fn: Object },
				
				/*
					Since this is a superset of the belongingProperty rule,
					this must come before it.
				*/
				belongingItProperty: {
					cannotFollow: ["text"],
					fn: textTokenFn("name")
				},
				
				belongingItOperator: {
					cannotFollow: ["text"],
					fn: Object
				},
				
				belongingProperty: {
					cannotFollow: ["text"],
					fn: textTokenFn("name"),
				},
				
				belongingOperator: {
					cannotFollow: ["text"],
					fn: Object
				},
				
				string: { fn: Object, },
				
				cssTime: {
					fn: function(match) {
						return {
							value: +match[1]
								* (match[2].toLowerCase() === "s" ? 1000 : 1),
						};
					},
				},
				
				colour: {
					cannotFollow: ["text"],
					/*
						The colour names are translated into hex codes here,
						rather than later in TwineScript.
					*/
					fn: function(match) {
						var colour,
							m = match[0].toLowerCase(),
							/*
								These colours are only at 80% saturation, so that
								authors using them as bare colours aren't unwittingly
								using horridly oversaturated shades.
							*/
							mapping = {
								"red"    : "e61919",
								"orange" : "e68019",
								"yellow" : "e5e619",
								"lime"   : "80e619",
								"green"  : "19e619",
								"cyan"   : "19e5e6",
								"aqua"   : "19e5e6",
								"blue"   : "197fe6",
								"navy"   : "1919e6",
								"purple" : "7f19e6",
								"fuchsia": "e619e5",
								"magenta": "e619e5",
								"white"  : "fff",
								"black"  : "000",
								"gray"   : "888",
								"grey"   : "888",
							};
						
						if (Object.hasOwnProperty.call(mapping, m)) {
							colour = "#" + mapping[m];
						}
						else {
							colour = m;
						}
						
						return {
							colour: colour,
						};
					},
				},
				
				number: {
					fn: function(match) {
						/*
							This fixes accidental octal (by eliminating octal)
						*/
						return {
							value: parseFloat(match[0]),
						};
					},
				},
				arithmetic: {
					fn: function(match) {
						return {
							operator: match[0],
						};
					},
				},
				inequality: {
					fn: function(match) {
						return {
							operator: match[0],
						};
					},
				},
				augmentedAssign: {
					fn: function(match) {
						return {
							// This selects just the first character, like the + of +=.
							operator: match[0][0],
						};
					},
				},
				identifier:          { fn: textTokenFn("name") },
			},
			["boolean", "is", "to", "into", "and", "or", "not",
			"isNot", "contains", "isIn"].reduce(function(a, e) {
				a[e] = {
					fn: Object,
					cannotFollow: ["text"],
				};
				return a;
			},{}),
			["comma", "spread"].reduce(function(a, e) {
				a[e] = { fn: Object };
				return a;
			},{})
		));
		/*
			Now that all of the rule categories have been defined, the modes can be
			defined as selections of these categories.
			
			Note: as the mode arrays are passed by reference by the above,
			the arrays must now be modified in-place, using [].push.apply().
		*/
		[].push.apply(markupMode,       Object.keys(blockRules)
								.concat(Object.keys(inlineRules))
								.concat(Object.keys(expressionRules)));
		/*
			Warning: the property pattern "'s" conflicts with the string literal
			pattern - "$a's b's" resembles a string literal. To ensure that
			the former is always matched first, expressionRules
			must be pushed first.
		*/
		[].push.apply(macroMode,        Object.keys(expressionRules)
								.concat(Object.keys(macroRules)));

		/*
			Merge all of the categories together.
		*/
		allRules = Object.assign({}, blockRules, inlineRules, expressionRules, macroRules);
		
		/*
			Add the 'pattern' property to each rule
			(the RegExp used by the lexer to match it), as well
			as some other properties.
		*/
		Object.keys(allRules).forEach(function(key) {
			/*
				Each named rule uses the same-named Pattern for its
				regular expression.
				That is, each rule key *should* map directly to a Pattern key.
				The Patterns are added now.
			*/
			var re = Patterns[key];
			if (typeof re !== "string") {
				allRules[key].pattern = re;
			}
			else {
				allRules[key].pattern = new RegExp(
					"^(?:" + re + ")",
					/*
						All TwineMarkup patterns are case-insensitive.
					*/
					"i"
				);
			}
			/*
				If an opener is available, include that as well.
				Openers are used as lookaheads to save calling
				the entire pattern regexp every time.
			*/
			if (Patterns[key + "Opener"]) {
				allRules[key].opener = Patterns[key + "Opener"];
			}
		});
		Object.assign(Lexer.rules, allRules);
		/*
			Declare that the starting mode for lexing, before any
			tokens are appraised, is...
		*/
		Lexer.startMode = markupMode;
		return Lexer;
	}
	
	function exporter(Lexer) {
		/**
			Export the TwineMarkup module.
			
			Since this is a light freeze, Utils and Patterns are still modifiable.
			
			@class TwineMarkup
			@static
		*/	
		var TwineMarkup = Object.freeze({
			
			/**
				@method lex
				@param {String} src String source to lex.
				@return {Array} Tree structure of
			*/
			lex: rules(Lexer).lex,
			
			/**
				Export the Patterns.
				
				@property {Object} Patterns
			*/
			Patterns: Patterns
		});
		return TwineMarkup;
	}
	
	/*
		This requires the Patterns and Lexer modules.
	*/
	if(typeof module === 'object') {
		Patterns = require('patterns');
		module.exports = exporter(require('lexer'));
	}
	else if(typeof define === 'function' && define.amd) {
		define('markup', ['lexer', 'patterns'], function (Lexer, P) {
			Patterns = P;
			return exporter(Lexer);
		});
	}
	else {
		Patterns = this.Patterns;
		this.TwineMarkup = exporter(this.TwineLexer);
	}
}).call(this || (typeof global !== 'undefined' ? global : window));
