define(['jquery', 'utils', 'utils/operationutils', 'internaltypes/twineerror'],
function($, Utils, OperationUtils, TwineError) {
	"use strict";
	/**
		This contains a registry of macro definitions, and methods to add to that registry.
		
		@class Macros
		@static
	*/
	
	var Macros,
		// Private collection of registered macros.
		macroRegistry = {},
		// Private collection of command definitions, which are created by command macros.
		commandRegistry = {};
		
	/*
		This function wraps another function (expected to be a macro implementation
		function) in such a way that its arguments are spread-out, error-checked,
		and then passed to the function.
	*/
	function readArguments(fn) {
		/*
			The arguments are already in array form - no need
			to use Array.from(arguments) here!
		*/
		return function macroResult(args) {
			
			// Spreaders are spread out now.
			args = args.reduce(function(newArgs, el) {
				if (el && el.spreader === true) {
					/*
						Currently, the full gamut of spreadable
						JS objects isn't available - only arrays, sets and strings.
					*/
					if (Array.isArray(el.value)
							|| typeof el.value === "string") {
						for(var i = 0; i < el.value.length; i++) {
							newArgs.push(el.value[i]);
						}
					}
					else if (el.value instanceof Set) {
						el.value.forEach(function(item) {
							newArgs.push(item);
						});
					}
					else {
						newArgs.push(
							TwineError.create("operation",
								"I can't spread out "
								+ OperationUtils.objectName(el.value)
								+ ", which is not a string or array."
							)
						);
					}
				}
				else {
					newArgs.push(el);
				}
				return newArgs;
			}, []);
			
			// Do the error check now.
			var error = TwineError.containsError(args);

			if (error) {
				return error;
			}
			return fn.apply(0, args);
		};
	}
	
	/*
		This function checks the type of a single argument. It's run
		for every argument passed into a type-signed macro.
		
		@param {Anything}     arg  The plain JS argument value to check.
		@param {Array|Object} type A type description to compare the argument with.
		@return {Boolean} True if the argument passes the check, false otherwise.
	*/
	function singleTypeCheck(arg, type) {
		/*
			First, check if it's a None type.
		*/
		if (type === null) {
			return arg === undefined;
		}
		/*
			Now, check if the signature is an Optional or Either.
		*/
		if (type.innerType) {
			/*
				Optional signatures can exit early if the arg is absent.
			*/
			if (type.pattern === "optional" || type.pattern === "zero or more") {
				if (arg === undefined) {
					return true;
				}
				type = type.innerType;
			}
			/*
				Either signatures must check every available type.
			*/
			if (type.pattern === "either") {
				/*
					The arg passes the test if it matches some of the types.
				*/
				return type.innerType.some(function(type) {
					return singleTypeCheck(arg, type);
				});
			}
		}
		// If Type but no Arg, then return an error.	
		if(type !== undefined && arg === undefined) {
			return false;
		}
				
		// The Any type permits any argument, as long as it's present.
		if (type === Macros.TypeSignature.Any && arg !== undefined) {
			return true;
		}
		/*
			The built-in types. Let's not get tricky here.
		*/
		if (type === String) {
			return typeof arg === "string";
		}
		if (type === Boolean) {
			return typeof arg === "boolean";
		}
		if (type === Number) {
			return typeof arg === "number";
		}
		if (type === Array) {
			return Array.isArray(arg);
		}
		if (type === Map || type === Set) {
			return arg instanceof type;
		}
		/*
			For TwineScript-specific types, this check should mostly suffice.
			TODO: I really need to replace those duck-typing properties.
		*/
		return Object.isPrototypeOf.call(type,arg);
	}
	
	/*
		This converts a passed macro function into one that performs type-checking
		on its inputs before running. It provides macro authors with another layer of
		error feedback.
		
		@param {String|Array}      name            The macro's name(s).
		@param {Function}          fn              A macro function.
		@param {Array|Object|null} typeSignature   An array of Twine macro parameter type data.
	*/
	function typeSignatureCheck(name, fn, typeSignature) {
		/*
			Return early if no signature was present for this macro.
		*/
		if (!typeSignature) {
			return fn;
		}
		/*
			The typeSignature *should* be an Array, but if it's just one item,
			we can normalise it to Array form.
		*/
		typeSignature = [].concat(typeSignature);
		
		/*
			The name is used solely for error message generation. It can be a String or
			an Array of Strings. If it's the latter, and there's more than one name,
			we'll (often incorrectly, but still informatively) use the first name,
			as we have no other information about which macro name was used.
			It's an uncomfortable state of affairs, I know.
		*/
		name = "(" + (Array.isArray(name) && name.length > 1 ? name[0] : name) + ":)";
		
		// That being done, we now have the wrapping function.
		return function typeCheckedMacro() {
			var args = Array.from(arguments)
				// The first argument is the Section, not a user-provided argument.
				// We discard it thus.
					.slice(1),
				type, arg, ind, end, rest;
			
			for(ind = 0, end = Math.max(args.length, typeSignature.length); ind < end; ind += 1) {
				type = typeSignature[ind];
				arg = args[ind];
				
				/*
					A rare early error check can be made up here: if ind >= typeSignature.length,
					and Rest is not in effect, then too many params were supplied.
				*/
				if (ind >= typeSignature.length && !rest) {
					return TwineError.create("macrocall", (args.length - typeSignature.length) +
						" too many values were given to this " + name + " macro.");
				}
				
				/*
					If a Rest type has already come before, then it will fill in for
					the absence of a type now.
				*/
				type || (type = rest);
				/*
					Conversely, if the rest type is being introduced now,
					we now note it down and extract the type parameter...
				*/
				if (type.innerType && (type.pattern === "rest" || type.pattern === "zero or more")) {
					rest = type.innerType;
					/*
						...but, we only extract the type parameter if it's a Rest.
						ZeroOrMore is used in singleTypeCheck as a synonym for Optional,
						and should remain boxed.
					*/
					if (type.pattern === "rest") {
						type = type.innerType;
					}
				}
				// Now do the check.
				if (!singleTypeCheck(arg,type)) {
					/*
						If the check failed, an error message must be supplied.
						We can infer the reason why singleTypeCheck returned just by
						examining arg.
						
						For instance, if the arg is undefined, then the problem is a
						"not enough values" error.
					*/
					if (arg === undefined) {
						return TwineError.create("macrocall", "The " + name + " macro needs "
							+ Utils.plural((typeSignature.length - ind), "more value") + ".");
					}
					
					/*
						Otherwise, it was the most common case: an invalid data type.
					*/
					return TwineError.create("datatype", name + "'s " +
						Utils.nth(ind + 1) + " value is " + OperationUtils.objectName(arg) +
						", but should be " +
						OperationUtils.typeName(type) + ".");
				}
			}
			/*
				Type checking has passed - now let the macro run.
			*/
			return fn.apply(0, arguments);
		};
	}
	
	/**
		The bare-metal macro registration function.
		If an array of names is given, an identical macro is created under each name.
		
		@method privateAdd
		@private
		@param {String|Array} name  A String, or an Array holding multiple strings.
		@param {String} type The type (either "sensor", "changer", or, and in absentia, "value")
		@param {Function} fn  The function.
	*/
	function privateAdd(name, type, fn) {
		// Add the fn to the macroRegistry, plus aliases (if name is an array of aliases)
		if (Array.isArray(name)) {
			name.forEach(function (n) {
				Utils.lockProperty(macroRegistry, Utils.insensitiveName(n), fn);
			});
		} else {
			Utils.lockProperty(macroRegistry, Utils.insensitiveName(name), fn);
		}
	}
	
	Macros = {
		/**
			Checks if a given macro name is registered.
			@method has
			@param {String} Name of the macro definition to check for existence
			@return {Boolean} Whether the name is registered.
		*/
		has: function (e) {
			e = Utils.insensitiveName(e);
			return macroRegistry.hasOwnProperty(e);
		},
		
		/**
			Retrieve a registered macro definition by name.
			
			@method get
			@param {String} Name of the macro definition to get
			@return Macro definition object, or false
		*/
		get: function (e) {
			e = Utils.insensitiveName(e);
			return (macroRegistry.hasOwnProperty(e) && macroRegistry[e]);
		},
		
		/**
			A high-level wrapper for add() that creates a Value Macro from 3
			entities: a macro implementation function, a ChangerCommand function, and
			a parameter type signature array.
			
			The passed-in function should return a changer.
			
			@method add
			@param {String} name
			@param {Function} fn
		*/
		add: function add(name, fn, typeSignature) {
			privateAdd(name,
				"value",
				readArguments(typeSignatureCheck(name, fn, typeSignature))
			);
			// Return the function to enable "bubble chaining".
			return add;
		},
	
		/**
			Takes a function, and registers it as a live Changer macro.
			
			Changers return a transformation function (a ChangerCommand) that is used to mutate
			a ChangeDescriptor object, that itself is used to alter a Section's rendering.
			
			The second argument, ChangerCommandFn, is the "base" for the ChangerCommands returned
			by the macro. The ChangerCommands are partial-applied versions of it, pre-filled
			with author-supplied parameters and given TwineScript-related expando properties.
			
			For instance, for (font: "Skia"), the changerCommandFn is partially applied with "Skia"
			as an argument, augmented with some other values, and returned as the ChangerCommand
			result.
			
			@method addChanger
			@param {String} name
			@param {Function} fn
			@param {Function} changerCommand
		*/
		addChanger: function addChanger(name, fn, changerCommandFn, typeSignature) {
			Utils.assert(changerCommandFn);
			
			privateAdd(name,
				"changer",
				readArguments(typeSignatureCheck(name, fn, typeSignature))
			);
			// I'll explain later. It involves registering the changerCommand implementation.
			commandRegistry[Array.isArray(name) ? name[0] : name] = changerCommandFn;
			
			// Return the function to enable "bubble chaining".
			return addChanger;
		},
		
		/**
			This simple getter should only be called by changerCommand, in its run() method, which
			allows the registered changer function to finally be invoked.
			
			TODO: This makes me wonder if this changer registering business shouldn't be in
			the changerCommand module instead.
			
			@method getChangerFn
			@param {String} name
			@return {Function} the registered changer function.
		*/
		getChangerFn: function getChanger(name) {
			return commandRegistry[name];
		},
		
		/*
			These helper functions/constants are used for defining semantic type signatures for
			standard library macros.
		*/
		TypeSignature: {
			
			optional: function(type) {
				return {pattern: "optional",         innerType: type };
			},
			
			zeroOrMore: function(type) {
				return {pattern: "zero or more",     innerType: type };
			},
			
			either: function(/*variadic*/) {
				return {pattern: "either",           innerType: Array.from(arguments)};
			},
			
			rest: function(type) {
				return {pattern: "rest",             innerType: type };
			},
			
			/*d:
				Any data
				
				A macro that is said to accept "Any" will accept any kind of data,
				without complaint, as long as the data does not contain any errors.
			*/
			Any: {
				TwineScript_TypeName: "anything",
			}, // In ES6, this would be a Symbol.
			
		},
		
		/**
			Runs a macro.
			
			In TwineScript.compile(), the myriad arguments given to a macro invocation are
			converted to 2 parameters to runMacro:
			
			@param {String} name     The macro's name.
			@param {Array}  args     An array enclosing the passed arguments.
			@return The result of the macro function.
		*/
		run: function(name, args) {
			var fn;
			// First and least, the error rejection check.
			if (TwineError.containsError(name)) {
				return name;
			}
			/*
				Check if the macro exists as a built-in.
			*/
			if (!Macros.has(name)) {
				return TwineError.create("macrocall",
					"I can't run the macro '"
					+ name
					+ "' because it doesn't exist."
				);
			}
			else fn = Macros.get(name);
			
			return fn(args);
		},
		
	};
	
	return Object.freeze(Macros);
});
