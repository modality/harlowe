/**
	The Lexer accepts plain strings, and, given a set of rules, transforms
	them to a tree of tokens.
	
	Consumers must augment this object's 'rules' property.
	
	@module Lexer
*/
(function(){
	"use strict";
	var Lexer,
		Token,
		tokenProto,
		rules = {};
	
	/*
		Polyfill for Object.assign()
	*/
	Object.assign = Object.assign || function polyfilledAssign(obj /* variadic */) {
		var i = 1,
			target, key;
		for(; i < arguments.length; i++) {
			target = arguments[i];
			for(key in target) {
				if(Object.hasOwnProperty.call(target, key)) {
					obj[key] = target[key];
				}
			}
		}
		return obj;
	};
	
	/*
		The "prototype" object for lexer tokens.
		(As an experiment in JS pseudo-classical syntax, instances are created
		by directly calling tokenMethods.constructor, which is otherwise nameless.)
		It just has some basic methods that iterate over tokens' children,
		but which nonetheless lexer customers may find valuable.
	*/
	tokenProto = {
		constructor: function() {
			for (var i = 0; i < arguments.length; i++) {
				Object.assign(this, arguments[i]);
			}
		},
		/*
			Create a token and put it in the children array.
		*/
		addChild: function addChild(tokenData) {
			var index = this.lastChildEnd(),
				childToken,
				matchText = tokenData.match;
			
			/*
				This accepts both regexp match arrays, and strings.
				For simplicity, extract the full match string from the array,
				if it indeed is one.
			*/
			if (Array.isArray(matchText)) {
				matchText = matchText[0];
			}
			
			/*
				Now, create the token, then assign to it the idiosyncratic data
				properties and the tokenMethods.
			*/
			childToken = new this.constructor(
				{
					start:     index,
					end:       matchText && index + matchText.length,
					text:      matchText,
					children:  []
				},
				tokenData);
				
			/*
				If the token has non-empty innerText, lex the innerText
				and append to its children array.
			*/
			if (childToken.innerText) {
				lex(childToken);
			}
			/*
				Having finished, push the child token to the children array.
			*/
			this.children.push(childToken);
			/*
				Let other things probe and manipulate the childToken; return it.
			*/
			return childToken;
		},
		
		/*
			Run a function on this token and all its children.
		*/
		forEach: function forEach(fn) {
			// This token
			fn(this);
			// All of its children
			this.children.forEach(function(e) { e.forEach(fn); });
		},
		
		/*
			A shortcut to the last element in the children array.
		*/
		lastChild: function lastChild() {
			return this.children ? this.children[this.children.length-1] || null : null;
		},
		
		/*
			lastChildEnd provides the end index of the last child token,
			allowing the start index of a new token to be calculated.
			
			Hence, when there are no children, it defaults to the start
			index of this token.
		*/
		lastChildEnd: function lastChildEnd() {
			var lastToken = this.lastChild();
			return lastToken ? lastToken.end : this.start || 0;
		},
		
		/*
			Given an index in this token's text, find the deepest leaf,
			if any, that corresponds to it.
		*/
		tokenAt: function tokenAt(index) {
			// First, a basic range check.
			if (index < this.start || index >= this.end) {
				return null;
			}
			/*
				Ask each child, if any, what their deepest token
				for this index is.
			*/
			if (this.children) {
				return this.children.reduce(function(prevValue, child) {
					return prevValue || child.tokenAt(index);
				}, null);
			}
			return this;
		},
		
		/*
			Given an index in this token's text, find the closest leaf
			(that is, only from among the token's immediate children)
			that corresponds to it.
		*/
		nearestTokenAt: function nearestTokenAt(index) {
			// First, a basic range check.
			if (index < this.start || index >= this.end) {
				return null;
			}
			/*
				Find whichever child has the index within its start-end range.
			*/
			if (this.children) {
				return this.children.reduce(function(prevValue, child) {
					return prevValue || ((index >= child.start && index < child.end) ? child : null);
				}, null);
			}
			return this;
		},
		
		/*
			Runs a function on every leaf token in the tree,
			and returns true if all returned truthy values.
		*/
		everyLeaf: function everyLeaf(fn) {
			var ret;
			if (!this.children || this.children.length === 0) {
				return !!fn(this);
			}
			return this.children.everyLeaf(function() { ret = ret && !!everyLeaf(fn); });
		},
		
		/*
			Check if all leaf nodes contain just whitespace.
		*/
		isWhitespace: function isWhitespace() {
			return this.everyLeaf(function(e) {
				/*
					Check if it's the 'whitespace' type... or if it's a
					mislabeled text leaf.
				*/
				return e.type === "whitespace" || !e.text.trim();
			});
		},
		
		/*
			Convert this token into a text token, in the simplest manner possible.
			
			TODO: Really, this should combine this with all adjacent text tokens.
		*/
		demote: function demote() {
			this.type = "text";
		},
		
		toString: function() {
			var ret = this.type;
			if (this.children && this.children.length > 0) {
				ret += "[" + this.children + "]";
			}
			return ret;
		}
	};
	Token = tokenProto.constructor;
	Token.prototype = tokenProto;
	
	/*
		The main lexing routine. Given a token with an innerText property and
		addChild methods, this function will lex its text into new tokens
		and add them as children.
	*/
	function lex(parentToken) {
		var
			// Some shortcuts
			src = parentToken.innerText,
			/*
				This somewhat simple stack determines what "mode"
				the lexer is in.
			*/
			modeStack = [parentToken.innerMode],
			/*
				The frontTokenStack's items are "front" tokens, those
				that pair up with a "back" token to make a token representing
				an arbitrarily nestable rule.
			*/
			frontTokenStack = [],
			// Some hoisted temporary vars used in each loop iteration.
			i, l, rule, match, slice,
			/*
				index ticks upward as we advance through the src.
				firstUnmatchedIndex is bumped up whenever a match is made,
				and is used to create "text" tokens between true tokens.
			*/
			index = 0,
			firstUnmatchedIndex = 0,
			/*
				This caches the most recently created token between iterations.
				This must be 'null' and not 'undefined' because some canFollow
				arrays may contain null, to mean the start of input.
			*/
			lastToken = null;
		
		/*
			Run through the src, character by character, matching all the
			rules on every slice, creating tokens as we go, until exhausted.
		*/
		while(index < src.length) {
			slice = src.slice(index);
			
			/*
				Run through all the rules in the current mode in turn.
				Note that modeStack[0] means "the current mode in the modeStack".
				Speed paranoia precludes the deployment of [].forEach() here.
			*/
			for (i = 0, l = modeStack[0].length; i < l; i+=1) {
				rule = rules[modeStack[0][i]];
				if (
						/*
							Check whether this rule is restricted to only being matched
							directly after another rule has. An example is the "block"
							rules, which may only match after a "br" or "paragraph"
							rule.
						*/
						(!rule.canFollow ||
							rule.canFollow.indexOf(
								/*
									Interesting note: this allows null lastTokens
									to be passed as-is, and object lastTokens to have
									their type checked - the short-circuit's falsy
									value's type matters here.
								*/
								lastToken && lastToken.type
							) >-1) &&
						/*
							Conversely, check whether this rule cannot follow after
							the previous rule.
						*/
						(!rule.cannotFollow || (
							/*
								For most cannotFollow items, this will suffice:
							*/
							rule.cannotFollow.indexOf(
								lastToken && lastToken.type
							) === -1 &&
							/*
								However, if cannotFollow contains "text", the check is more
								tricky: the last text token hasn't been forged yet. So,
								this line must be used:
							*/
							!(rule.cannotFollow.indexOf("text") > -1 && firstUnmatchedIndex < index)
							)) &&
						/*
							If an opener is available, check that before running
							the full match regexp.
						*/
						(!rule.opener || rule.opener.exec(slice.slice(0, rule.opener.length || Infinity))) &&
						/*
							Finally, run the pattern. Any earlier would cause the rules excluded
							by the above checks to be run anyway, and waste time.
						*/
						(match = rule.pattern.exec(slice))) {
					/*
						Now that it's matched, let's forge this token.
						First, create a token out of the interstitial unmatched
						text between this and the last "proper" token.
					*/
					if (firstUnmatchedIndex < index) {
						parentToken.addChild({
							type: "text",
							match: src.slice(firstUnmatchedIndex, index),
							innerMode: modeStack[0]
						});
					}
					// Create a token using the matched rule's fn.
					lastToken = parentToken.addChild(rule.fn(match));
					
					// Increment the index in the src
					index += lastToken.text.length;
					firstUnmatchedIndex = index;
					
					/*
						Front tokens are saved, in case a Back token arrives
						later that can match it.
					*/
					if (lastToken.type.endsWith("Front")) {
						frontTokenStack.unshift(lastToken);
						
						// Ugh, modes
						modeStack.unshift(lastToken.innerMode);
					}
					/*
						If a Back token arrives, it must match with the most recent Front token.
						If so, both tokens, and those intervening, are merged ("folded") into one.
					*/
					else if (lastToken.type.endsWith("Back")) {
						if (frontTokenStack.length &&
							lastToken.matches && frontTokenStack[0].type in lastToken.matches) {
							/*
								Having found a matching pair of tokens, we fold them together.
								Note: this function splices the children array in-place!!
								Fortunately, nothing needs to be adjusted to account for this.
							*/
							foldTokens(parentToken, lastToken, frontTokenStack.shift());
							
							// I'll explain later.
							modeStack.shift();
						}
						else {
							/*
								It doesn't match anything...! It's just prose text, then.
								Demote the token to a text token.
							*/
							lastToken.demote();
						}
					}
					// Break from the for-loop
					break;
				}
			}
			
			/*
				If no match was available, then advance one character and loop again.
			*/
			if (i === l) {
				index += 1;
				if (lastToken === null) {
					lastToken = "text";
				}
			}
		}
		
		/*
			Push the last run of unmatched text before we go.
		*/
		if (firstUnmatchedIndex < index) {
			parentToken.addChild({
				type: "text",
				match: src.slice(firstUnmatchedIndex, index),
				innerMode: modeStack[0]
			});
		}
		/*
			We're done, except that we may still have unmatched frontTokens.
			Go through them and demote them.
		*/
		while(frontTokenStack.length > 0) {
			frontTokenStack.shift().demote();
		}
		return parentToken;
	}
	
	/*
		To waylay speed concerns, the tokens are passed in as tuples:
		the token object itself, and its index within the parentToken's
		children array.
	*/
	function foldTokens(parentToken, backToken, frontToken) {
		/*
			Having found a matching pair of tokens, we fold them together.
			For convenience, let's promote the Back token (currently, "child")
			into the folded-up single token.
		*/
		var backTokenIndex   = parentToken.children.indexOf(backToken),
			frontTokenIndex  = parentToken.children.indexOf(frontToken),
			// Hoisted loop vars
			i, l, key;

		/*
			First, find the tokens enclosed by the pair, and make them the
			Back token's children.
		*/
		backToken.children = parentToken.children.splice(
			frontTokenIndex + 1,
			/*
				This quantity selects only those after the Front token
				and before the Back token.
			*/
			(backTokenIndex) - (frontTokenIndex + 1)
		);
		
		/*
			Change its type to the actual type, without the "Back" suffix.
			
			Recall that a Back token's "matches" array maps Front token types
			(the key) to full token types (the value).
		*/
		backToken.type = backToken.matches[frontToken.type];
		
		/*
			Change its text and innerText to reflect its contents.
		*/
		backToken.innerText = "";
		for (i = 0, l = backToken.children.length; i < l; i++) {
			backToken.innerText += backToken.children[i].text;
		}
		
		/*
			The text includes the original enclosing tokens around the
			innerText.
			
			In the case of a hook, this reflects the syntax structure:
			"[" + hook contents + "]"
		*/
		backToken.text = frontToken.text + backToken.innerText + backToken.text;
		
		/*
			Copy other properties that the Front token possesses but
			the Back token does not.
			
			Assumption: that the Back token and Front token will never
			have colliding props. If so, then they are left as they are.
		*/
		for (key in frontToken) {
			if(Object.hasOwnProperty.call(frontToken, key)
				&& !Object.hasOwnProperty.call(backToken, key)) {
				backToken[key] = frontToken[key];
			}
		}
		
		/*
			Remove the Front token.
		*/
		parentToken.children.splice(frontTokenIndex, 1);

		/*
			Oh, before I forget: if the new token is a macro, we'll have to lex()
			its children all again. Sorry ;_;
			
			TODO: change to "has a different mode than the currently prevailing mode"
		*/
		if (backToken.type === "macro") {
			backToken.children = [];
			lex(backToken);
		}
	}
	
	/*
		This is the returned object representing the lexer inner state.
	*/
	Lexer = {
		/*
			The main function.
			This returns the entire set of tokens, rooted in a "root"
			token that has all of tokenMethods's methods.
		*/
		lex: function(src, initIndex) {
			var ret = lex(new Token({
				type:                 "root",
				start:        initIndex || 0,
				end:              src.length,
				text:                    src,
				innerText:               src,
				children:                 [],
				innerMode:   Lexer.startMode,
			}));
			return ret;
		},
		/*
			The (initially empty) rules object should be augmented with
			whatever rules the language requires.
		*/
		rules: rules
	};
	if(typeof module === 'object') {
		module.exports = Lexer;
	}
	else if(typeof define === 'function' && define.amd) {
		define('lexer', [], function () {
			return Lexer;
		});
	}
	else {
		this.TwineLexer = Lexer;
	}
}).call(this || (typeof global !== 'undefined' ? global : window));
