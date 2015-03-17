define([
	'jquery',
	'macros',
	'utils',
	'utils/operationutils',
	'state',
	'engine',
	'datatypes/assignmentrequest',
	'internaltypes/twineerror',
	'internaltypes/twinenotifier'],
function($, Macros, Utils, OperationUtils, State, Engine, AssignmentRequest, TwineError, TwineNotifier) {
	"use strict";
	
	var
		rest = Macros.TypeSignature.rest,
		zeroOrMore = Macros.TypeSignature.zeroOrMore,
		Any = Macros.TypeSignature.Any;
	
	Macros.add
		/*d:
			VariableToValue data
			
			This is a special value that only (set:) and (put:) make use of.
			It's created by joining a variable and a value with the `to` or `into` keywords:
			`$emotion to 'flustered'` is an example of a VariableToValue. It exists primarily to
			make (set:) and (put:) more readable.
		*/
		/*d:
			(set: VariableToValue, [...VariableToValue]) -> String
			
			Stores data values in variables.
			
			Example usage:
			```
			(set: $battlecry to "Save a " + $favouritefood + " for me!")
			```
			
			Rationale:
			
			Variables are data storage for your game. You can store values under names and refer to
			them later. They persist between passages, and can be used throughout the entire game.
			
			Variables have many purposes: keeping track of what the player has accomplished,
			managing some other state of the story, storing hook styles and changers, and
			other such things. You can display variables by putting them in passage text,
			attach them to hooks, and create and change them using the (set:) and (put:) macros.
			
			Details:
			
			In its basic form, a variable is created or changed using `(set: ` variable `to` value `)`.
			You can also set multiple variables in a single (set:) by separating each VariableToValue
			with commas: `(set: $weapon to 'hands', $armour to 'naked')`, etc.
			
			You can also use `it` in expressions on the right-side of `to`. Much as in other
			expressions, it's a shorthand for what's on the left side: `(set: $vases to it + 1)`
			is a shorthand for `(set: $vases to $vases + 1)`.
			
			If the variable you're setting cannot be changed - for instance, if it's the $Design
			variable - then an error will be printed.
			
			If you use (set:) as an expression, it just evaluates to an empty string.
			
			See also:
			(push:)
		*/
		("set", function set(_, assignmentRequests /*variadic*/) {
			var i, ar, result,
				debugMessage = "";
			
			assignmentRequests = Array.prototype.slice.call(arguments, 1);
			
			/*
				This has to be a plain for-loop so that an early return
				is possible.
			*/
			for(i = 0; i < assignmentRequests.length; i+=1) {
				ar = assignmentRequests[i];
				
				if (ar.operator === "into") {
					return TwineError.create("macrocall", "Please say 'to' when using the (set:) macro.");
				}
				result = ar.dest.set(ar.src);
				/*
					If the setting caused an error to occur, abruptly return the error.
				*/
				if (TwineError.isPrototypeOf(result)) {
					return result;
				}
				if (Engine.options.debug) {
					// Add a semicolon only if a previous iteration appended a message.
					debugMessage += (debugMessage ? "; " : "")
						+ OperationUtils.objectName(ar.dest)
						+ " is now "
						+ OperationUtils.objectName(ar.src);
				}
			}
			return debugMessage && TwineNotifier.create(debugMessage);
		},
		[rest(AssignmentRequest)])
		
		/*d:
			(put: [VariableToValue]) -> String
			
			A left-to-right version of (set:) that requires the word `into` rather than `to`.
			
			Rationale:
			This macro has an identical purpose to (set:) - it creates and changes variables.
			For a basic explanation, see the rationale for (set:).
			
			Almost every programming language has a (set:) construct, and most of these place the
			variable on the left-hand-side. However, a minority, such as HyperTalk, place the variable
			on the right. Harlowe allows both to be used, depending on personal preference. (set:) reads
			as `(set: ` variable `to` value `)`, and (put:) reads as `(put: ` value `into` variable `)`.
			
			Details:
			
			Just as with (set:), a variable is changed using `(put: ` value `into` variable `)`. You can
			also set multiple variables in a single (put:) by separating each VariableToValue
			with commas: `(put: 2 into $batteries, 4 into $bottles)`, etc.
			
			`it` can also be used with (put:), but, interestingly, it's used on the right-hand side of
			the expression: `(put: $eggs + 2 into it)`.
		*/
		("put", function put(_, assignmentRequests /*variadic*/) {
			var i, ar, result;
			
			assignmentRequests = Array.prototype.slice.call(arguments, 1);
			
			/*
				This has to be a plain for-loop so that an early return
				is possible.
			*/
			for(i = 0; i < assignmentRequests.length; i+=1) {
				ar = assignmentRequests[i];
				
				if (ar.operator === "to") {
					return TwineError.create("macrocall", "Please say 'into' when using the (put:) macro.");
				}
				result = ar.dest.set(ar.src);
				/*
					If the setting caused an error to occur, abruptly return the error.
				*/
				if (TwineError.isPrototypeOf(result)) {
					return result;
				}
			}
			return "";
		},
		[rest(AssignmentRequest)])
		
		/*
			(move:) A variant of (put:) that deletes the source's binding after
			performing the operation. Ideally used as an equivalent
			to Javascript's "x = arr.pop();"
		*/
		("move", function move(_, ar) {
			var get, error;
			
			if (ar.src && ar.src.varref) {
				get = ar.src.get();
				if ((error = TwineError.containsError(get))) {
					return error;
				}
				ar.dest.set(get);
				ar.src.delete();
			}
			else {
				/*
					Fallback behaviour: when phrased as
					(move: 2 into $red)
				*/
				ar.dest.set(ar.src);
			}
			return "";
		},
		[rest(AssignmentRequest)])

		
		/*
			ARRAY MACROS
		*/
		
		/*d:
			Array data
			
			There are occasions when you may need to work with a sequence of values of unknown length.
			For example, a sequence of adjectives (describing the player) that should be printed depending
			on what a numeric variable (such as a health point variable) currently is.
			You could create many, many variables to hold each value, but it is preferable to
			use an array containing these values.
			
			Arrays are one of the two major "data structures" you can use in Harlowe. The other, datamaps,
			are created with (datamap:). Generally, you want to use arrays when you're dealing with values that
			directly correspond to *numbers*, and whose *order* and *position* relative to each other matter.
			If you instead need to refer to values by a name, and don't care about their order, a datamap is best used.
			
			Array data is referenced much like string characters are. You can refer to data positions using `1st`,
			`2nd`, `3rd`, and so forth: `$array's 1st` refers to the value in the first position. Additionally, you can
			use `last` to refer to the last position, `2ndlast` to refer to the second-last, and so forth. Arrays also
			have a `length` number: `$array's length` tells you how many values are in it.
			
			Arrays may be joined by adding them together: `(a: 1, 2) + (a: 3, 4)` is the same as `(a: 1, 2, 3, 4)`.
			You can only join arrays to other arrays. To add a bare value to the front or back of an array, you must
			put it into an otherwise empty array using the (a:) macro: `$myArray + (a:5)` will make an array that's just
			$myArray with 5 added on the end, and `(a:0) + $myArray` is $myArray with 0 at the start.
			
			You may note that certain macros, like (either:), accept sequences of values. A special operator, `...`, exists which
			can "spread out" the values inside an array, as if they were individually placed inside the macro call.
			`(either: ...$array)` is a shorthand for `(either: $array's 1st, $array's 2nd, $array's 3rd)`, and so forth for as many
			values as there are inside the $array. Note that you can still include values after the spread: `(either: 1, ...$array, 5)`
			is valid and works as expected.
		*/
		/*d:
			(a: [...Any]) -> Array
			Also known as: (array:)
			
			Creates an array, which is an ordered collection of values.
			
			Example usage:
			`(a:)` creates an empty array, which could be filled with other values later.
			`(a: "gold", "frankincense", "myrrh")` creates an array with three strings.
			
			Rationale:
			For an explanation of what arrays are, see the Array article. This macro is the primary
			means of creating arrays - simply supply the values to it, in order.
			
			Details:
			Note that due to the way the spread `...` operator works, spreading an array into
			the (a:) macro will accomplish nothing: `(a: ...$array)` is the same as just the `$array`.
			
			See also:
			(datamap:), (dataset:)
		*/
		(["a", "array"], function() {
			return Array.from(arguments).slice(1);
		}, zeroOrMore(Any))
		
		/*d:
			(range:)
			
			Produces an array containing an *inclusive* range of integers from a to b.
			
			Example usage:
			`(range:1,14)` is equivalent to `(a:1,2,3,4,5,6,7,8,9,10,11,12,13,14)`
			
			Rationale:
			This macro is a shorthand for defining an array that contains a sequence of
			integer values. Rather than writing out all of the numbers, you can simply provide
			the first and last numbers.
			
			Details:
			Certain kinds of macros, like (either:), accept sequences of values. You can
			use (range:) with these in conjunction with the `...` spreading operator:
			`(dataset: ...(range:2,6))` is equivalent to `(dataset: 2,4,5,6,7)`, and
			`(either: ...(range:1,5))` is equivalent to `(random: 1,5)`.
			
			See also:
			(a:), (subarray:)
		*/
		("range", function range(_, a, b) {
			/*
				For now, let's assume descending ranges are intended,
				and support them.
			*/
			if (a > b) {
				return range(_, b, a).reverse();
			}
			/*
				This differs from Python: the base case returns just [a],
				instead of an empty array. The rationale is that since it is
				inclusive, a can serve as both start and end term just fine.
			*/
			var ret = [a];
			b -= a;
			while(b-- > 0) {
				ret.push(++a);
			}
			return ret;
		},
		[Number, Number])
		
		/*
			(subarray:)
			Produces a slice of the given array, cut from
			the *inclusive* indices a and b.
			A match of (substring:).
		*/
		("subarray", function subarray(_, array, a, b) {
			return OperationUtils.subset(array, a, b);
		},
		[Array, Number, Number])
		
		/*
			(history:)
			Returns the array of past passage names, directly from State.
			This is used to implement the visited() function from Twine 1.
		*/
		("history", function history() {
			return State.pastPassageNames();
		},
		[])
		
		/*
			DATAMAP MACROS
		*/
		/*
			(datamap:)
			Similar to (a:), these create standard JS Maps and Sets.
			But, instead of supplying an iterator, you supply keys and values
			interleaved: (datamap: key, value, key, value).
			
			One concern about maps: even though they are a Map,
			inserting a non-primitive in key position is problematic because
			retrieving the key uses compare-by-reference, and most
			of Twine 2's unique object types are immutable (hence, can't be
			used in by-reference comparisons).
		*/
		("datamap", function() {
			var key, ret;
			/*
				This converts the flat arguments "array" into an array of
				key-value pairs [[key, value],[key, value]].
				During each odd iteration, the element is the key.
				Then, the element is the value.
			*/
			/*
				Note that, as is with most macro functions in this file,
				the slice(1) eliminates the implicit first Section argument.
			*/
			ret = new Map(Array.from(arguments).slice(1).reduce(function(array, element) {
				if (key === undefined) {
					key = element;
				}
				else {
					array.push([key, element]);
					key = undefined;
				}
				return array;
			}, []));
			
			/*
				One error can result: if there's an odd number of arguments, that
				means a key has not been given a value.
			*/
			if (key !== undefined) {
				return new TypeError("This datamap has a key without a value.");
			}
			return ret;
		},
		zeroOrMore(Any))
		
		/*
			DATASET MACROS
		*/
		/*
			(dataset:)
			Sets are more straightforward - their JS constructors can accept
			arrays straight off.
		*/
		("dataset", function() {
			return new Set(Array.from(arguments).slice(1));
		},
		zeroOrMore(Any))
		
		/*
			COLLECTION OPERATIONS
		*/
		/*
			(count:)
			Accepts 2 arguments - a collection and a value - and returns the number
			of occurrences of the value in the collection, using the same semantics
			as the "contains" operator.
		*/
		("count", function(_, collection, value) {
			switch(OperationUtils.collectionType(collection)) {
				case "dataset":
				case "datamap": {
					return +collection.has(name);
				}
				case "string": {
					if (typeof value !== "string") {
						return new TypeError(
							OperationUtils.objectName(collection)
							+ " can't contain  "
							+ OperationUtils.objectName(value)
							+ " because it isn't a string."
						);
					}
					return collection.split(value).length-1;
				}
				case "array": {
					return collection.reduce(function(count, e) {
						return count + (e === value);
					}, 0);
				}
			}
		},
		[Any, Any])
		
		// End of macros
		;
});
