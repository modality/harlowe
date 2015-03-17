define(['utils', 'internaltypes/twineerror'], function(Utils, TwineError) {
	"use strict";
	
	/*
		First, a quick shortcut to determine whether the
		given value is an object (i.e. whether the "in"
		operator can be used on a given value).
	*/
	function isObject(value) {
		return !!value && (typeof value === "object" || typeof value === "function");
	}
	
	/*
		Next, a quick function used for distinguishing the 3 types of collections
		native to TwineScript.
	*/
	function collectionType(value) {
		return Array.isArray(value) ? "array" :
			value instanceof Map ? "datamap" :
			value instanceof Set ? "dataset" :
			value && typeof value === "object" ? "object" :
			/*
				If it's not an object, then it's not a collection. Return
				a falsy string (though I don't condone using this function in
				Boolean position).
			*/
			"";
	}
	/*
		Next, a shortcut to determine whether a given value should have
		sequential collection functionality (e.g. Array, String, other stuff).
	*/
	function isSequential(value) {
		return typeof value === "string" || Array.isArray(value);
	}
	/*
		Now, a function to clone arbitrary values.
		This is only a shallow clone, designed for use by VarRef.set()
		to make a distinct copy of an object after assignment.
	*/
	function clone(value) {
		if (!isObject(value)) {
			return value;
		}
		/*
			If it has a custom TwineScript clone method, use that.
		*/
		if (typeof value.TwineScript_Clone === "function") {
			return value.TwineScript_Clone();
		}
		/*
			If it's an array, the old standby is on call.
		*/
		if (Array.isArray(value)) {
			return [].concat(value);
		}
		/*
			For ES6 collections, we can depend on the constructors.
		*/
		if (value instanceof Map) {
			return Object.assign(new Map(value), value);
		}
		if (value instanceof Set) {
			return Object.assign(new Set(value), value);
		}
		/*
			If it's a function, Function#bind() makes a copy without altering its 'this'.
		*/
		if (typeof value === "function") {
			return Object.assign(value.bind(), value);
		}
		/*
			If it's a plain object or null object, you can rely on Object.assign().
		*/
		switch (Object.getPrototypeOf(value)) {
			case Object.prototype:
				return Object.assign({}, value);
			case null:
				return Object.assign(Object.create(null), value);
		}
		/*
			If we've gotten here, something unusual has been passed in.
		*/
		Utils.impossible("Operations.clone", "The value " + value + " cannot be cloned!");
		return value;
	}

	/*
		Some TwineScript objects can, in fact, be coerced to string.
		HookRefs, for instance, coerce to the string value of their first
		matching hook.
		
		(Will I pay for this later???)
		
		This returns the resulting string, or false if it couldn't be performed.
		@return {String|Boolean}
	*/
	function coerceToString(fn, left, right) {
		if (typeof left  === "string" && isObject(right) &&
				"TwineScript_ToString" in right) {
			return fn(left, right.TwineScript_ToString());
		}
		/*
			We can't really replace this case with a second call to
			canCoerceToString, passing (fn, right, left), because fn
			may not be symmetric.
		*/
		if (typeof right === "string" && isObject(left) &&
				"TwineScript_ToString" in left) {
			return fn(left.TwineScript_ToString(), right);
		}
		return false;
	}
	
	/*
		Most TwineScript objects have an ObjectName method which supplies a name
		string to the error message facilities.
		@return {String}
	*/
	function objectName(obj) {
		return (isObject(obj) && "TwineScript_ObjectName" in obj)
			? obj.TwineScript_ObjectName
			: Array.isArray(obj) ? "an array"
			: obj instanceof Map ? "a datamap"
			: obj instanceof Set ? "a dataset"
			: typeof obj === "boolean" ? "the logic value '" + obj + "'"
			: (typeof obj === "string" || typeof obj === "number")
				? 'the ' + typeof obj + " " + Utils.toJSLiteral(obj)
			: "...whatever this is";
	}
	/*
		The TypeName method is also used to supply error messages relating to type signature
		checks. Generally, a TwineScript datatype prototype should be supplied to this function,
		compared to objectName, which typically should receive instances.
		
		Alternatively, for Javascript types, the global constructors String, Number, Boolean,
		Map, Set, and Array may be given.
		
		Finally, certain "type descriptor" objects are used by Macros, and take the form
			{ pattern: {String, innerType: {Array|Object|String} }
		and these should be warmly received as well.
		
		@return {String}
	*/
	function typeName(obj) {
		/*
			First, check for the "either" type descriptor.
		*/
		if (obj.innerType) {
			if (obj.pattern === "either") {
				Utils.assert(Array.isArray(obj.innerType));
				
				return obj.innerType.map(typeName).join(" or ");
			}
			else if (obj.pattern === "optional") {
				return "(an optional) " + typeName(obj.innerType);
			}
			return typeName(obj.innerType);
		}
		
		return (
			/*
				Second, if it's a global constructor, simply return its name in lowercase.
			*/
			(   obj === String ||
				obj === Number ||
				obj === Boolean)  ? "a "  + obj.name.toLowerCase()
			:  (obj === Map ||
				obj === Set)      ? "a data" + obj.name.toLowerCase()
			:   obj === Array     ? "an " + obj.name.toLowerCase()
			/*
				Otherwise, defer to the TwineScript_TypeName, or TwineScript_ObjectName
			*/
			: (isObject(obj) && "TwineScript_TypeName" in obj) ? obj.TwineScript_TypeName
			: objectName(obj)
		);
	}
	
	/*
		As TwineScript uses pass-by-value rather than pass-by-reference
		for all objects, it must also use compare-by-value for objects as well.
		This function implements the "is" operation.
		@return {Boolean}
	*/
	function is(l, r) {
		/*
			For primitives, === is sufficient.
		*/
		if (typeof l !== "object" && typeof r !== "object") {
			return l === r;
		}
		/*
			For Arrays, compare every element and position of one
			with the other.
		*/
		if (Array.isArray(l) && Array.isArray(r)) {
			/*
				A quick check: if they vary in length, they already fail.
			*/
			if (l.length !== r.length) {
				return false;
			}
			return l.every(function(element, index) {
				return is(r[index], element);
			});
		}
		/*
			For Maps and Sets, simply reduce them to Arrays.
		*/
		if (l instanceof Map && r instanceof Map) {
			// Don't forget that Map.prototype.entries() returns an iterator!
			return is(
				// Since datamaps are supposed to be unordered, we must sort these arrays
				// so that different-ordered maps are regarded as equal.
				Array.from(l.entries()).sort(),
				Array.from(r.entries()).sort()
			);
		}
		if (l instanceof Set && r instanceof Set) {
			return is(Array.from(l.values()), Array.from(r.values()));
		}
		/*
			For TwineScript built-ins, use the TwineScript_is() method to determine
			uniqueness.
		*/
		if (l && typeof l.TwineScript_is === "function") {
			return l.TwineScript_is(r);
		}
		return Object.is(l, r);
	}
	
	/*
		As the base function for Operations.contains,
		this implements the "x contains y" and "y is in x" keywords.
		This is placed outside so that Operation.isIn can call it.
		@return {Boolean}
	*/
	function contains(container,obj) {
		/*
			TODO: this has the problem, though, that all objects are compared by reference
			using JS's strict equality algorithm, rather than a more intuitive
			compare-by-value proposition.
		*/
		if (container) {
			if (typeof container === "string") {
				return container.indexOf(obj) > -1;
			}
			if(Array.isArray(container)) {
				return container.some(function(e) {
					return is(e, obj);
				});
			}
			/*
				For Sets and Maps, check that the key exists.
			*/
			if (container instanceof Set || container instanceof Map) {
				return Array.from(container.keys()).some(function(e) {
					return is(e, obj);
				});
			}
		}
		/*
			Default: since "'r' is in 'r'" is true, so is "false is in false".
		*/
		return is(container, obj);
	}
	
	/*
		This calls the slice() method of the given sequence, but takes TwineScript (subarray:)
		and (substring:) indices (which are 1-indexed), converting them to those preferred by JS.
	*/
	function subset(sequence, a, b) {
		var ret, isString = typeof sequence === "string";
		/*
			A zero index or a NaN index is an error.
		*/
		if (!a || !b) {
			return TwineError.create(
				"macrocall",
				"The sub" + collectionType(sequence) + " index arguments must not be 0 or NaN."
			);
		}
		/*
			To simplify things, convert negative indices into positive ones.
		*/
		if (a < 0) {
			a = sequence.length + a + 1;
		}
		if (b < 0) {
			b = sequence.length + b + 1;
		}
		/*
			For now, let's assume descending ranges are intended,
			and support them.
		*/
		if (a > b) {
			return subset(sequence, b, a);
		}
		/*
			As mentioned elsewhere in Operations, JavaScript's irksome UCS-2 encoding for strings
			means that, in order to treat astral plane characters as 1 character in 1 position,
			they must be converted to and from arrays whenever indexing or .slice() is performed.
		*/
		if (isString) {
			sequence = Array.from(sequence);
		}
		/*
			As the positive indices are 1-indexed, we shall subtract 1 from a if a is positive.
			But, as they're inclusive, b shall be left as is.
		*/
		ret = sequence.slice(a > 0 ? a - 1 : a, b);
		/*
			Now that that's done, convert any string sequence back into one.
		*/
		if (isString) {
			return ret.join('');
		}
		return ret;
	}
	
	var OperationUtils = Object.freeze({
		isObject: isObject,
		collectionType: collectionType,
		isSequential: isSequential,
		clone: clone,
		coerceToString: coerceToString,
		objectName: objectName,
		typeName: typeName,
		is: is,
		contains: contains,
		subset: subset,
		/*
			Used to determine if a property name is an array index.
			If negative indexing sugar is ever added, this could
			be replaced with a function.
		*/
		numericIndex: /^(?:[1-9]\d*|0)$/,
	});
	return OperationUtils;
});
