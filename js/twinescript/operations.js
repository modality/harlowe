define([
	'utils',
	'state',
	'datatypes/colour',
	'datatypes/assignmentrequest',
	'utils/operationutils',
	'internaltypes/twineerror',
],
function(Utils, State, Colour, AssignmentRequest, OperationUtils, TwineError) {
	"use strict";
	/**
		Operation objects are a table of operations which TwineScript proxies
		for/sugars over JavaScript. These include basic fixes like the elimination
		of implicit type coercion and the addition of certain early errors, but also
		includes support for new TwineScript operators, overloading of old operators,
		and other things.
		
		@class Operations
	*/
	var Operations,
		/*
			In ES6, this would be a destructured assignment.
		*/
		isObject        = OperationUtils.isObject,
		collectionType  = OperationUtils.collectionType,
		coerceToString  = OperationUtils.coerceToString,
		objectName      = OperationUtils.objectName,
		contains        = OperationUtils.contains,
		/*
			The "it" keyword is bound to whatever the last left-hand-side value
			in a comparison operation was. Since its scope is so ephemeral,
			it can just be a shared identifier right here.
		*/
		It = 0;
	
	/*
		Here are some wrapping functions which will be applied to
		the Operations methods, providing type-checking and such to their arguments.
	*/
	
	/*
		Wraps a function to refuse its arguments if one
		of them is not a certain type of primitive.
		@param {String} type Either "number" or "boolean"
		@param {Function} fn The function to wrap.
		@param {String} [operationVerb] A verb describing the function's action.
		@return {Function}
	*/
	function onlyPrimitives(type, fn, operationVerb) {
		operationVerb = operationVerb || "do this to";
		return function(left, right) {
			var error;
			/*
				If the passed function has an arity of 1, ignore the
				right value.
			*/
			if (fn.length === 1) {
				right = left;
			}
			/*
				This part allows errors to propagate up the TwineScript stack.
			*/
			if ((error = TwineError.containsError(left, right))) {
				return error;
			}
			if (typeof left !== type || typeof right !== type) {
				return TwineError.create("operation", "I can only "
				+ operationVerb + " " + type + "s, not "
				+ objectName(typeof left !== type ? left : right)
				+ ".");
			}
			return fn(left, right);
		};
	}
	
	/*
		Converts a function to type-check its two arguments before
		execution, and thus suppress JS type coercion.
		@return {Function}
	*/
	function doNotCoerce(fn) {
		return function(left, right) {
			var error;
			/*
				This part allows errors to propagate up the TwineScript stack.
			*/
			if ((error = TwineError.containsError(left, right))) {
				return error;
			}
			// VarRefs cannot have operations performed on them.
			if (left && left.varref) {
				return TwineError.create("operation", "I can't give an expression a new value.");
			}
			/*
				This checks that left and right are generally different types
				(both different typeof or, if both are object, different collection types)
			*/
			if (typeof left !== typeof right
				|| collectionType(left) !== collectionType(right)) {
				/*
					Attempt to coerce to string using TwineScript specific
					methods, and return an error if it fails.
				*/
				return coerceToString(fn, left, right)
					/*
						TwineScript errors are handled by TwineScript, not JS,
						so don't throw this error, please.
					*/
					|| TwineError.create("operation",
						// BUG: This isn't capitalised.
						objectName(left)
						+ " isn't the same type of data as "
						+ objectName(right)
					);
			}
			return fn(left, right);
		};
	}
	
	/*
		Converts a function to set It after it is done.
		@return {Function}
	*/
	function comparisonOp(fn) {
		return function(left, right) {
			It = left;
			return fn(left, right);
		};
	}

	/*
		Now, let's define the operations themselves.
	*/
	Operations = {
		
		/*
			While for the most part Operations is static, instances should
			nonetheless be created...
		*/
		create: function(section) {
			/*
				The only varying state that an Operations instance would have
				compared to the prototype is this "section" argument, which
				as it turns out is only used to enable the "time" identifier.
				Hrmmm... #awkward
			*/
			
			var ret = Object.create(this);
			
			/*
				This contains special runtime identifiers which may change at any time.
			*/
			ret.Identifiers = {

				get it() {
					return It;
				},
				
				/*
					The "time" keyword binds to the number of milliseconds since the passage
					was rendered.
			
					It might be something of a toss-up whether the "time" keyword should
					intuitively refer to the entire passage's lifetime, or just the nearest
					hook's. I believe that the passage is what's called for here.
				*/
				get time() {
					// This is, as far as I know, the only "this" usage in the class.
					return (Date.now() - section.timestamp);
				}
				/*
					TODO: An author-facing error message for setting time()
				*/
			};
			
			return ret;
		},
		
		"and": onlyPrimitives("boolean", doNotCoerce(function(l, r) {
			return l && r;
		}), "use 'and' to join"),
		
		"or": onlyPrimitives("boolean", doNotCoerce(function(l, r) {
			return l || r;
		}), "use 'or' to join"),
		
		"not": onlyPrimitives("boolean", function(e) {
			return !e;
		}, "use 'not' to invert"),
		
		"+":  doNotCoerce(function(l, r) {
			var ret;
			/*
				I'm not a fan of the fact that + is both concatenator and
				arithmetic op, but I guess it's close to what people expect.
				Nevertheless, applying the logic that a string is just as much a
				sequential collection as an array, I feel I can overload +
				on collections to mean immutable concatenation or set union.
			*/
			if (Array.isArray(l)) {
				/*
					Note that the doNotCoerce wrapper above requires that
					the right side also be an array.
				*/
				return [].concat(l, r);
			}
			/*
				For Maps and Sets, create a new instance combining left and right.
				You may note that in the case of Maps, values of keys used on the
				right side trump those on the left side.
			*/
			if (l instanceof Map) {
				ret = new Map(l);
				r.forEach(function(v,k) {
					ret.set(k, v);
				});
				return ret;
			}
			if (l instanceof Set) {
				ret = new Set(l);
				r.forEach(function(v) {
					ret.add(v);
				});
				return ret;
			}
			/*
				If a TwineScript object implements a + method, use that.
			*/
			else if (typeof l["TwineScript_+"] === "function") {
				return l["TwineScript_+"](r);
			}
			/*
				Finally, if it's a primitive, we defer to JS's addition operator.
			*/
			if ("string|number|boolean".includes(typeof l)) {
				return l + r;
			}
			/*
				Having got this far, there's nothing else that can be added.
				Return an error.
			*/
			return TwineError.create("operation", "I can't use + on " + objectName(l) + ".");
		}),
		"-":  doNotCoerce(function(l, r) {
			var ret;
			/*
				Overloading - to mean "remove all instances from".
				So, "reed" - "e" = "rd", and [1,3,5,3] - 3 = [1,5].
			*/
			if (Array.isArray(l)) {
				/*
					Note that the doNotCoerce wrapper above requires that
					the right side also be an array. Subtracting 1 element
					from an array requires it be wrapped in an (a:) macro.
				*/
				return l.filter(function(e) { return r.indexOf(e) === -1; });
			}
			/*
				Sets, but not Maps, can be subtracted.
			*/
			else if (l instanceof Set) {
				ret = new Set(l);
				r.forEach(function(v) {
					ret.delete(v);
				});
				return ret;
			}
			else if (typeof l === "string") {
				/*
					This is an easy but cheesy way to remove all instances
					of the right string from the left string.
				*/
				return l.split(r).join('');
			}
			return l - r;
		}),
		"*":  onlyPrimitives("number", doNotCoerce(function(l, r) {
			return l * r;
		}), "multiply"),
		"/":  onlyPrimitives("number", doNotCoerce(function(l, r) {
			if (r === 0) {
				return TwineError.create("operation", "I can't divide " + objectName(l) + " by zero.");
			}
			return l / r;
		}), "divide"),
		"%":  onlyPrimitives("number", doNotCoerce(function(l, r) {
			if (r === 0) {
				return TwineError.create("operation", "I can't modulo " + objectName(l) + " by zero.");
			}
			return l % r;
		}), "modulus"),
		
		"<":  comparisonOp( onlyPrimitives("number", doNotCoerce(function(l,r) { return l <  r; }), "do < to")),
		">":  comparisonOp( onlyPrimitives("number", doNotCoerce(function(l,r) { return l >  r; }), "do > to")),
		"<=": comparisonOp( onlyPrimitives("number", doNotCoerce(function(l,r) { return l <= r; }), "do <= to")),
		">=": comparisonOp( onlyPrimitives("number", doNotCoerce(function(l,r) { return l >= r; }), "do >= to")),
		
		is: comparisonOp(OperationUtils.is),
		
		isNot: comparisonOp(function(l,r) {
			return !Operations.is(l,r);
		}),
		contains: comparisonOp(contains),
		isIn: comparisonOp(function(l,r) {
			return contains(r,l);
		}),
		
		/*
			This takes a plain value assumed to be an array, and wraps
			it in a special structure that denotes it to be spreadable.
			This is created by the spread (...) operator.
		*/
		makeSpreader: function(val) {
			return {
				value: val,
				spreader: true,
			};
		},
		
		/*
			And here is the function for creating AssignmentRequests.
			Because a lot of error checking must be performed, and
			appropriate error messages must be generated, all of this
			is part of TwineScript instead of the AssignmentRequest module.
		*/
		makeAssignmentRequest: function(dest, src, operator) {
			var propertyChain,
				/*
					Refuse if the object or value is an error.
				*/
				error = TwineError.containsError(dest, src);
			
			if (error) {
				return error;
			}
			
			/*
				Also refuse if the dest is not, actually, a VarRef.
			*/
			if (!isObject(dest) || !("compiledPropertyChain" in dest)) {
				return TwineError.create("operation",
					"I can't store a new value inside "
					+ objectName(dest)
					+ ".");
			}
			propertyChain = dest.compiledPropertyChain;
			
			// The input is all clear, it seems.
			return AssignmentRequest.create(dest, src, operator);
		},
		
		/*
			This helper function sets the It identifier to a passed-in VarRef,
			while returning the original VarRef.
			It's used for easy compilation of assignment requests.
		*/
		setIt: function(e) {
			/*
				Propagate any errors passed in, as usual for these operations.
				Note that this does NOT handle errors returned in
				wrappers by VarRef.create(), because those should only be unwrapped
				when the compiler tries to .get() them.
			*/
			if (TwineError.containsError(e)) {
				return e;
			}
			/*
				If a non-varRef was passed in, a syntax error has occurred.
			*/
			if (!e.varref) {
				return TwineError.create("operation",
					"I can't put a new value into "
					+ objectName(e)
					+ "."
				);
			}
			return (It = e.get()), e;
		},
	};
	return Object.freeze(Operations);
});
