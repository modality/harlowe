define(['utils'], function(Utils) {
	"use strict";
	
	/**
		A module that handles the JIT compilation of TwineScript syntax tokens
		(received from TwineMarkup) into Javascript code that calls Operations methods.
		
		@class Compiler
		@static
	*/
	
	/*
		Before I continue, I'd like to explain the API for "TwineScript datatype" objects.
		This is an otherwise plain object that may implement any of the following:
		
		{Function|String} TwineScript_ObjectName:
			returns a string that's used when TwineScript needs to
			name the object in error messages or the debug menu.
		
		{Function} TwineScript_Clone:
			a function which clones the value, even if it's an oddly-shaped object.
			Should be used exclusively by VarRef.set().
		
		{Function} TwineScript_+:
			a function which is used to overload the + operator. Note that TwineScript
			automatically forces both sides of + to be of identical type.
		
		{Function} TwineScript_Print:
			a function which is used when the given object is printed into the passage.
		
		{Function} TwineScript_ToString:
			returns a string that's used when the object CAN be implicitly
			coerced to string. This should be used very sparingly.
		
		{Function} set TwineScript_Assignee:
			a setter function that, if present, proxies the act of setting a value to
			this object, if it's usable as an lvalue. Currently hardcoded to only
			work for hookRefs!!
		
		{Function} toString:
			if this is present and !== Object.prototype.toString, then this is
			used by Section to convert this datatype to renderable TwineMarkup code.
			This is named "toString" so that Array, Function and other objects can be
			interpreted by Section.
	*/

	/*
		Everything preceding was concerned with runtime TwineScript operations.
		From here on are functions concerned with compile-time TwineScript -
		that is, compiling TwineScript into JS.
	*/

	/*
		A helper function for compile(). When given a token array, and a
		bunch of token type strings, it returns the index in the array of the
		first token that has one of those types. Very useful.
		
		@param {Array} array The tokens array.
		@param {String} type* The token type(s).
		@return {Number} The array index, or NaN.
	*/
	function indexOfType(array, type /* variadic */) {
		var i,
			types = (arguments.length === 1
				? type
				: Array.prototype.slice.call(arguments, 1));
		
		for (i = 0; i < array.length; i+=1) {
			/*
				Odd fact: unary + is often used to convert non-numbers to
				numbers, but it also converts negative numbers to positive.
				So, use 0+ instead when that matters.
			*/
			if (0+types.indexOf(array[i].type) > -1) {
				return i;
			}
		}
		return NaN;
	}
	
	function rightAssociativeIndexOfType(array /* variadic */) {
		/*
			What this does is tricky: it reverses the passed-in array,
			calls the normal indexOfType, then inverts the returned index
			(converting, say, 3/10 on the reversed array into 7/10 on
			the original array).
			
			For browser optimisation purposes, arguments is copied into an
			array
		*/
		var a = Array.prototype.slice.call(arguments, 0);
		/*
			Regrettably, .reverse() is an in-place method, so a copy must be
			manually made.
		*/
		a[0] = Array.from(array).reverse();
		return (array.length - 1) - indexOfType.apply(0, a);
	}
	
	/**
		This takes an array from TwineMarkup, rooted at an expression,
		and returns raw Javascript code for the expression's execution.
		
		@method compile
		@param {Array} tokens The tokens array.
		@param {Boolean} isVarRef Whether the returned expression should be a VarRef.
		@return {String} String of Javascript code.
	*/
	function compile(tokens, isVarRef) {
		var i,
			/*
				These hold the returned compilations of the tokens
				surrounding a currently matched token, as part of this function's
				recursive descent.
			*/
			left, right,
			/*
				Hoisted temp variables
			*/
			macroNameToken, token,
			/*
				Setting values to either of these variables
				determines the code to emit:
				- for midString, a plain JS infix operation between left and right;
				- for operation, an Operations method call with left and right as arguments.
				- for assignment, an AssignmentRequest.
				- for possessive, a special VarRef.create() call.
			*/
			midString, operation, assignment, possessive,
			/*
				Some operators should present a simple error when one of their sides is missing.
			*/
			needsLeft = true, needsRight = true,
			/*
				Some JS operators, like >, don't automatically work when the other side
				is absent, even when people expect them to. e.g. $var > 3 and < 5 (which is
				legal in Inform 6). To cope, I implicitly convert a blank left side to
				"it", which is the nearest previous left-hand operand.
			*/
			implicitLeftIt = false;
		
		/*
			Recursive base case: no tokens.
			Any behaviour that should be done in the event of no tokens
			must be performed elsewhere.
		*/
		if (!tokens) {
			return "";
		}
		// Convert tokens to a 1-size array if it's just a single non-array.
		tokens = [].concat(tokens);
		
		/*
			Potential early return if we're at a leaf node.
		*/
		if (tokens.length === 1) {
			token = tokens[0];
			
			if (token.type === "identifier") {
				if (isVarRef) {
					/*
						This error message is a bit ugly, I must admit...
					*/
					return "TwineError.create('keyword','I can\\'t use \\'" + token.text + "\\' in this position.') ";
				}
				return " Operations.Identifiers." + token.text.toLowerCase() + " ";
			}
			else if (token.type === "variable") {
				return "VarRef.create(State.variables,"
					+ Utils.toJSLiteral(token.name)
					+ ")" + (isVarRef ? "" : ".get()");
			}
			else if (token.type === "hookRef") {
				/*
					Some remarks:
					
					1. Note that the 'section' is that provided by the environ,
					and is not the Section prototype.
					2. The ? sigil is needed to distinguish the hook name
					from a pseudo-hook selector string.
				*/
				if (isVarRef) {
					/*
						Assignments to hookRefs assign text to all of their matching hooks.
						
						TwineScript_Assignee is a setter accessor used as a TwineScript
						assignment interface.
					*/
					return "VarRef.create(section.selectHook('?" + token.name + "'), 'TwineScript_Assignee')";
				}
				return " section.selectHook('?" + token.name + "') ";
			}
			else if (token.type === "string") {
				/*
					Note that this is entirely reliant on the fact that TwineScript string
					literals are currently exactly equal to JS string literals (minus template
					strings and newlines).
				*/
				return token.text.replace(/\n/g, "\\n");
			}
			else if (token.type === "colour") {
				return "Colour.create("
					+ Utils.toJSLiteral(token.colour)
					+ ")";
			}
			/*
				Root tokens are usually never passed in, but let's
				harmlessly handle them anyway.
			*/
			else if (token.type === "root") {
				return compile(token.children);
			}
		}
		
		/*
			Attempt to find the index of a valid token, using this
			order of precedence:
			
			grouping ()
			property 's
			macro
			not
			multiply
			divide
			modulo
			add
			subtract
			<
			<=
			>
			>=
			contains
			is
			is not
			and
			or
			to
			spread ...
			comma
			
			We must check these in reverse, so that the least-precedent
			is associated last.
		*/
		
		/*
			I'll admit it: I'm not yet sure what place the JS comma will have in
			TwineScript. As of right now, let's just pass it through
			at the correct precedence, and require both sides.
		*/
		if ((i = indexOfType(tokens, "comma")) >-1) {
			midString = ",";
			/*
				Unlike Javascript, Twinescript allows trailing commas in calls.
			*/
			needsRight = false;
		}
		else if ((i = indexOfType(tokens, "spread")) >-1) {
			/*
				Whether or not this actually makes sense as a "mid"string
				is probably easily disputed.
			*/
			midString = "Operations.makeSpreader(";
			right =
				compile(tokens.splice(i + 1))
				+ ")";
			needsLeft = false;
		}
		else if ((i = indexOfType(tokens, "to")) >-1) {
			assignment = "to";
			left  = "Operations.setIt(" + compile(tokens.slice(0,  i), "varRef") + ")";
		}
		else if ((i = indexOfType(tokens, "into")) >-1) {
			assignment = "into";
			right = compile(tokens.slice(0,  i), "varRef");
			left  = "Operations.setIt(" + compile(tokens.slice(i + 1), "varRef") + ")";
		}
		/*
			I'm also not sure if augmented assignment is strictly necessary given that
			one can do (set: $x to it+1), and += is sort of an overly abstract token.
		*/
		else if ((i = indexOfType(tokens, "augmentedAssign")) >-1) {
			assignment = tokens[i].operator;
			left  = compile(tokens.slice(0,  i), "varRef");
			/*
				This line converts the "b" in "a += b" into "a + b" (for instance),
				thus partially de-sugaring the augmented assignment.
				
				Note that the left tokens must be compiled again, as a non-varRef this time.
				
				Note also that this assumes the token's assignment property corresponds to
				a binary-arity Operation method name.
			*/
			right = "Operations['" + assignment + "']("
				+ (compile(tokens.slice (0,  i)) + ","
				+  compile(tokens.splice(i + 1))) + ")";
		}
		else if ((i = indexOfType(tokens, "and", "or")) >-1) {
			operation = tokens[i].type;
		}
		else if ((i = indexOfType(tokens, "is", "isNot")) >-1) {
			implicitLeftIt = true;
			operation = tokens[i].type;
		}
		else if ((i = indexOfType(tokens, "contains", "isIn")) >-1) {
			implicitLeftIt = true;
			operation = tokens[i].type;
		}
		else if ((i = indexOfType(tokens, "inequality")) >-1) {
			implicitLeftIt = true;
			operation = tokens[i].operator;
		}
		else if ((i = indexOfType(tokens, "arithmetic")) >-1) {
			operation = tokens[i].operator;

			/*
				Since arithmetic can also be the unary - and + tokens,
				we must, in those cases, change the left token to 0 if
				it doesn't exist.
				This would ideally be an "implicitLeftZero", but, well...
			*/
			if ("+-".includes(tokens[i].text)) {
				left  = compile(tokens.slice(0,  i));
				/*
					If only whitespace is to the left of this operator...
				*/
				if (!left.trim()) {
					left = "0";
				}
			}
		}
		else if ((i = indexOfType(tokens, "not")) >-1) {
			midString = "Operations.not(";
			right =
				compile(tokens.splice(i + 1))
				+ ")";
			needsLeft = false;
		}
		else if ((i = indexOfType(tokens, "belongingProperty")) >-1) {
			/*
				As with the preceding case, we need to manually wrap the variable side
				inside the Operations.get() call, while leaving the other side as is.
			*/
			right = "VarRef.create("
				/*
					belongingProperties place the variable on the right.
				*/
				+ compile(tokens.slice (i + 1), "varref")
				+ ","
				/*
					Utils.toJSLiteral() is used to both escape the name
					string and wrap it in quotes.
				*/
				+ Utils.toJSLiteral(tokens[i].name) + ")"
				+ (isVarRef ? "" : ".get()");
			midString = " ";
			needsLeft = needsRight = false;
		}
		else if ((i = indexOfType(tokens, "belongingOperator", "belongingItOperator")) >-1) {
			if (tokens[i].type.includes("It")) {
				right = "Operations.Identifiers.it";
				needsRight = false;
			}
			possessive = "belonging";
		}
		/*
			Notice that this one is right-associative instead of left-associative.
			This must be so because, by branching on the rightmost token, it will compile to:
				VarRef.create(VarRef.create(a,1).get(),2).get()
			instead of the incorrect:
				VarRef.create(a,1).get() VarRef.create(,2).get()
		*/
		else if ((i = rightAssociativeIndexOfType(tokens, "property")) >-1) {
			/*
				This is somewhat tricky - we need to manually wrap the left side
				inside the Operations.get() call, while leaving the right side as is.
			*/
			left = "VarRef.create("
				+ compile(tokens.slice (0, i), "varref")
				+ ","
				/*
					Utils.toJSLiteral() is used to both escape the name
					string and wrap it in quotes.
				*/
				+ Utils.toJSLiteral(tokens[i].name) + ")"
				+ (isVarRef ? "" : ".get()");
			midString = " ";
			needsLeft = needsRight = false;
		}
		else if ((i = rightAssociativeIndexOfType(tokens, "itsProperty")) >-1
				|| (i = indexOfType(tokens, "belongingItProperty")) >-1) {
			/*
				This is actually identical to the above, but with the difference that
				there is no left subtoken (it is always Identifiers.it).
			*/
			left = "VarRef.create(Operations.Identifiers.it,"
				+ Utils.toJSLiteral(tokens[i].name) + ").get()";
			midString = " ";
			needsLeft = needsRight = false;
		}
		else if ((i = rightAssociativeIndexOfType(tokens, "possessiveOperator", "itsOperator")) >-1) {
			if (tokens[i].type.includes("it")) {
				left = "Operations.Identifiers.it";
				needsLeft = false;
			}
			possessive = "possessive";
		}
		else if ((i = indexOfType(tokens, "macro")) >-1) {
			/*
				The first child token in a macro is always the method name.
			*/
			macroNameToken = tokens[i].children[0];
			Utils.assert(macroNameToken.type === "macroName");
			
			midString = 'Macros.run('
				/*
					The macro name, if it constitutes a method call, contains a
					variable expression representing which function should be called.
					Operations.runMacro will, if given a function instead of a string
					identifier, run the function in place of a macro's fn.
				*/
				+ (macroNameToken.isMethodCall
					? compile(macroNameToken.children)
					: '"' + tokens[i].name + '"'
				)
				/*
					The arguments given to a macro instance are given in an array.
				*/
				+ ', ['
				/*
					The first argument to macros must be the current section,
					so as to give the macros' functions access to data
					about the runtime state (such as, whether this expression
					is nested within another one).
				*/
				+ "section,"
				/*
					You may notice here, unseen, is the assumption that Javascript array literals
					and TwineScript macro invocations use the same character to separate arguments/items.
					(That, of course, being the comma - (macro: 1,2,3) vs [1,2,3].)
					This is currently true, but it is nonetheless a fairly bold assumption.
				*/
				+ compile(tokens[i].children.slice(1))
				+ '])';
			needsLeft = needsRight = false;
		}
		else if ((i = indexOfType(tokens, "grouping")) >-1) {
			midString = "(" + compile(tokens[i].children, isVarRef) + ")";
			needsLeft = needsRight = false;
		}
		
		/*
			If a token was found, we can recursively
			compile those next to it.
		*/
		if (i >- 1) {
			/*
				Any of the comparisons above could have provided specific
				values for left and right, but usually they will just be
				the tokens to the left and right of the matched one.
			*/
			left  = left  || (compile(tokens.slice (0,  i), isVarRef)).trim();
			right = right || (compile(tokens.splice(i + 1))).trim();
			/*
				The compiler should implicitly insert the "it" keyword when the
				left-hand-side of a comparison operator was omitted.
			*/
			if (implicitLeftIt && !(left)) {
				left = " Operations.Identifiers.it ";
			}
			/*
				If there is no implicitLeftIt, produce an error message.
			*/
			if ((needsLeft && !left) || (needsRight && !right)) {
				return "TwineError.create('operation','I need some code to be "
					+ (needsLeft ? "left " : "")
					+ (needsLeft && needsRight ? "and " : "")
					+ (needsRight ? "right " : "")
					+ "of "
					+ '"' + tokens[i].text + '"'
					+ "')";
			}

			if (midString) {
				return left + midString + right;
			}
			else if (assignment) {
				return "Operations.makeAssignmentRequest("
					+ [left, right, Utils.toJSLiteral(assignment)]
					+")";
			}
			else if (possessive) {
				return "VarRef.create("
					+ (possessive === "belonging" ? right : left)
					+ ",{computed:true,value:"
					+ (possessive === "belonging" ? left : right)
					+ "})"
					+ (isVarRef ? "" : ".get()");
			}
			else if (operation) {
				return " Operations[" + Utils.toJSLiteral(operation) + "](" + left + "," + right + ") ";
			}
		}
		/*
			Base case: just convert the tokens back into text.
		*/
		else if (tokens.length === 1) {
			/*
				This should default to a " " so that some separation lies between tokens.
				Otherwise, some tokens like "contains" will break in certain (rare) circumstances.
			*/
			return ((token.value || token.text) + "").trim() || " ";
		}
		else {
			return tokens.reduce(function(a, token) { return a + compile(token, isVarRef); }, "");
		}
		return "";
	}
	
	return compile;
});
