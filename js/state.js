define([
	'utils',
	'systemvariables/design',
	'systemvariables/passages',
	'systemvariables/saves',
	'internaltypes/twineerror',
], function(Utils, Design, Passages, Saves, TwineError) {
	"use strict";
	/**
		State
		Singleton controlling the running game state.
		
		@class State
		@static
	*/
	
	/*
		The root prototype for every Moment's variables collection.
	*/
	var SystemVariables = {
		/*
			Note that it's not possible for userland TwineScript to directly access or
			modify this base object.
		*/
		Design:     Design,
		Passages:   Passages,
		Saves:      Saves,
		TwineScript_ObjectName: "this story's variables",
		/*
			This property means that these property names cannot be set to new
			user values via (set:). Of course, mutating their contents
			will cause new versions of them to appear in the Moment's variables map.
		*/
		TwineScript_Writeproof: ["Design", "Passages"],
	};

	/**
		Prototype object for states remembered by the game.
		
		@class Moment
		@for State
	*/
	var Moment = {
		/**
			Current passage name
			@property {String} passage
			@for Moment
		*/
		passage: "",
		
		/**
			Variables
			@property {Object} variables
			@for Moment
		*/
		variables: SystemVariables,

		/**
			Make a new Moment that comes temporally after this.
			This is usually a fresh Moment, but the State deserialiser
			must re-create prior sessions' Moments.
			Thus, pre-set variables may be supplied to this method.
			
			@method create
			@for Moment
			@param {String} p The name of the passage that the player is at in this moment.
			@param {Object} [v] Variables to include in this moment.
			@returns {Moment} created object
		*/
		create: function (p, v) {
			var ret = Object.create(Moment);
			ret.passage = p || "";
			// Variables are stored as deltas of the previous state's variables.
			// This is implemented using JS's prototype chain :o
			// For the first moment, this becomes a call to Object.create(null),
			// keeping the prototype chain clean.
			ret.variables = Object.assign(Object.create(this.variables), v);
			return ret;
		}
	};
	
	/*
		Stack of previous states.
		This includes both the past (moments the player has created) as well as the future (moments
		the player has undone).
		Count begins at 0 (the game start).
	*/
	var timeline = [ ];
	
	/*
		Index to the game state just when the current passage was entered.
		This represents where the player is within the timeline.
		Everything beyond this index is the future. Everything before and including is the past.
		It usually equals timeline.length-1, except when the player undos.
	*/
	var recent = -1;
	
	/*
		The present - the resultant game state after the current passage executed.
		This is a 'potential moment' - a moment that could become the newest to enter the timeline.
		This is pushed onto the timeline (becoming "recent") when going forward,
		and discarded when going backward.
		Its passage name should equal that of recent.
	*/
	var present = Moment.create();
	
	/*
		The serialisability status of the story state.
		This starts as true, but will be irreversibly set to false
		whenever a non-serialisable object is stored in a variable.
	*/
	var serialisable = true;
	
	/*
		The current game's state.
	*/
	var State = Object.assign({
		/*
			Getters/setters
		*/

		/**
			Get the current passage name.
			Used as a common argument to Engine.showPassage()
			
			@property {String} passage
			@for State
		*/
		get passage() {
			return present.passage;
		},
		
		/**
			Get the current variables.
			
			@property {Array} variables
		*/
		get variables() {
			return present.variables;
		},

		/**
			Is there an undo cache?
			@property {Number} pastLength
		*/
		get pastLength() {
			return recent;
		},

		/**
			Is there a redo cache?
			@property {Number} futureLength
		*/
		get futureLength() {
			return (timeline.length - 1) - recent;
		},
		
		/**
			Returns a TwineError if the named passage does not exist in the
			current state of the Passages store, or is in an invalid datamap format.
			This should be used for most Passage existence checks.
			
			@method passageExists
			@param {String} passageName Name of the passage to query.
			@return {TwineError|Boolean} true if it exists, or a TwineError if not.
		*/
		passageExists: function(passageName) {
			var passageMap = this.variables.Passages.get(passageName);
			if (!passageMap) {
				return TwineError.create("macrocall",
					"I can't display the passage '"
					+ name
					+ "' because it doesn't exist."
				);
			}
			/*
				Even if it exists, the passageMap could be an author-created-at-runtime
				datamap, and as such should be carefully examined.
			*/
			if (!(passageMap instanceof Map) || !passageMap.has('prose')) {
				return TwineError.create("operation",
					"The passage '" + name + "' isn't a datamap with a 'prose' data key."
				);
			}
			return true;
		},

		/**
			Did we ever visit this passage, given its name?
			Return the number of times visited.
			
			@method passageNameVisited
			@param {String} name Name of the passage.
			@return {Boolean} Whether it was visited.
		*/
		passageNameVisited: function (name) {
			var i, ret = 0;

			if (!Passages.get(name)) {
				return 0;
			}
			for (i = 0; i <= recent; i++) {
				ret += +(name === timeline[i].passage);
			}

			return ret;
		},

		/**
			Return how long ago this named passage has been visited.
			
			@method passageNameLastVisited
			@param {String} name Name of the passage.
			@return {Number} How many turns ago it was visited.
		*/
		passageNameLastVisited: function (name) {
			var i;

			if (!Passages.get(name)) {
				return Infinity;
			}

			if (name === present.passage) {
				return 0;
			}

			for (i = recent; i > 0; i--) {
				if (timeline[i].passage === name) {
					return (recent-i) + 1;
				}
			}

			return Infinity;
		},

		/**
			Return an array of names of all previously visited passages, in the order
			they were visited. This may include doubles.
			
			@method previousPassage
			@return {Array} Array of previously visited passages.
		*/
		pastPassageNames: function () {
			var i, ret = [];

			for (i = recent-1; i >= 0; i--) {
				ret.unshift(timeline[i].passage);
			}
			return ret;
		},

		/*
			Movers/shakers
		*/
		
		/**
			Create a new present after altering the state
			@method newPresent
			@param {String} newPassageName The name of the passage the player is now currently at.
		*/
		newPresent: function(newPassageName) {
			present = (timeline[recent] || Moment).create(newPassageName);
		},

		/**
			Push the present state to the timeline, and create a new state.
			@method play
			@param {String} newPassageName The name of the passage the player is now currently at.
		*/
		play: function (newPassageName) {
			if (!present) {
				Utils.impossible("State.play","present is undefined!");
			}
			// Assign the passage name
			present.passage = newPassageName;
			// Clear the future, and add the present to the timeline
			timeline = timeline.slice(0,recent+1).concat(present);
			recent += 1;
			
			// Create a new present
			this.newPresent(newPassageName);
		},

		/**
			Rewind the state. This will fail if the player is at the first moment.
			
			@method rewind
			@param {String|Number} arg Either a string (passage id) or a number of steps to rewind.
			@return {Boolean} Whether the rewind was actually performed.
		*/
		rewind: function (arg) {
			var steps = 1,
				moved = false;

			if (arg) {
				if (typeof arg === "string") {
					steps = this.passageNameLastVisited(arg);
					if (steps === Infinity) {
						return;
					}
				} else if (typeof arg === "number") {
					steps = arg;
				}
			}
			for (; steps > 0 && recent > 0; steps--) {
				moved = true;
				recent -= 1;
			}
			if (moved) {
				this.newPresent(timeline[recent].passage);
			}
			return moved;
		},

		/**
			Undo the rewinding of a state. Fails if no moments are in the future to be redone.
			Currently only accepts numbers.
			
			@method  fastForward
			@param {Number} arg The number of turns to move forward.
			@return {Boolean} Whether the fast-forward was actually performed.
		*/
		fastForward: function (arg) {
			var steps = 1,
				moved = false;
			
			if (typeof arg === "number") {
				steps = arg;
			}
			for (; steps > 0 && timeline.length > 0; steps--) {
				moved = true;
				recent += 1;
			}
			if (moved) {
				this.newPresent(timeline[recent].passage);
			}
			return moved;
		},
		
		/**
			This method is only for debugging purposes. It is called nowhere except for the test specs.
			
			@method reset
		*/
		reset: function() {
			timeline = [];
			recent = -1;
			present = Moment.create();
			serialisable = true;
		},
	},
	/*
		In addition to the above simple methods, two serialisation methods are also present.
		These have a number of helper functions which are wrapped in this IIFE.
	*/
	(function(){
		
		/*
			This helper checks if serialisation is possible for this data value.
			Currently, most all native JS types are supported, but TwineScript
			specific command objects aren't.
		*/
		function isSerialisable(variable) {
			return (typeof variable === "number"
				|| typeof variable === "boolean"
				|| typeof variable === "string"
				// Nulls shouldn't really ever appear in TwineScript, but technically they're allowed.
				|| variable === null
				|| Array.isArray(variable) && variable.every(isSerialisable)
				|| variable instanceof Set && Array.from(variable).every(isSerialisable)
				|| variable instanceof Map && Array.from(variable.values()).every(isSerialisable));
		}
		
		/*
			This is provided to JSON.stringify(), allowing Maps and Sets to be
			stringified, albeit in a bespoke fashion.
		*/
		function replacer(name, variable) {
			if (variable instanceof Set) {
				return {
					'(dataset:)': Array.from(variable),
				};
			}
			if (variable instanceof Map) {
				return {
					/*
						Array.from(map) converts the variable to
						an array of key-value pairs.
					*/
					'(datamap:)': Array.from(variable),
				};
			}
			return variable;
		}
		
		/*
			This is provided to JSON.parse(), allowing Maps and Sets to be
			revived from the encoding method used above.
		*/
		function reviver(name, variable) {
			if (Object.prototype.isPrototypeOf(variable)) {
				if (Array.isArray(variable['(dataset:)'])) {
					return new Set(variable['(dataset:)']);
				}
				if (Array.isArray(variable['(datamap:)'])) {
					return new Map(variable['(datamap:)']);
				}
			}
			return variable;
		}
		
		/**
			Serialise the game history, from the present backward (ignoring the redo cache)
			into a JSON string.
			
			@method serialise
			@return {String|Boolean} The serialised state, or false if serialisation failed.
		*/
		function serialise() {
			var ret = timeline.slice(0, recent + 1);
			/*
				We must determine if the state is serialisable.
				Once it is deemed unserialisable, it remains that way for the rest
				of the story. (Note: currently, rewinding back past a point
				where an unserialisable object was (set:) does NOT revert the
				serialisability status.)
			*/
			serialisable = serialisable && ret.every(function(moment) {
				return Object.keys(moment.variables).every(function(e) {
					var variable = moment.variables[e];
				
					return isSerialisable(variable);
				});
			});
			/*
				If it can't be serialised, just return false. Don't worry, it's
				the responsibility of the caller to create a proper TwineError
				as a result of this.
			*/
			if (!serialisable) {
				return false;
			}
			try {
				return JSON.stringify(ret, replacer);
			}
			catch(e) {
				return false;
			}
		}
		
		/**
			Deserialise the string and replace the current history.
			@method deserialise
		*/
		function deserialise(str) {
			var newTimeline,
				lastVariables = SystemVariables;
			
			try {
				newTimeline = JSON.parse(str, reviver);
			}
			catch(e) {
				return false;
			}
			/*
				Verify that the timeline is an array.
			*/
			if (!Array.isArray(newTimeline)) {
				return false;
			}
			
			if ((newTimeline = newTimeline.map(function(moment) {
				/*
					Here, we do some brief verification that the moments in the array are
					objects with "passage" and "variables" keys.
				*/
				if (typeof moment !== "object"
						|| !moment.hasOwnProperty("passage")
						|| !moment.hasOwnProperty("variables")) {
					return false;
				}
				/*
					Recreate the variables prototype chain. This doesn't use setPrototypeOf() due to
					compatibility concerns.
				*/
				moment.variables = Object.assign(Object.create(lastVariables), moment.variables);
				
				lastVariables = moment.variables;
				/*
					Re-establish the moment objects' prototype link to Moment.
				*/
				return Object.assign(Object.create(Moment), moment);
			})).indexOf(false) > -1) {
				return false;
			}
			timeline = newTimeline;
			recent = timeline.length - 1;
			this.newPresent(timeline[recent].passage);
		}
		return {
			serialise: serialise,
			deserialise: deserialise,
		};
	}()));
	
	Object.seal(Moment);
	return Object.freeze(State);
});
