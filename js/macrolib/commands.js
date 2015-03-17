define(['macros', 'utils', 'state', 'engine', 'internaltypes/twineerror', 'utils/operationutils'],
function(Macros, Utils, State, Engine, TwineError, OperationUtils) {
	"use strict";
	
	/*d:
		Command data
		
		Commands are special kinds of data which perform an effect when they're placed in the passage.
		Most commands are created from macros placed directly in the passage, but, like all forms of
		data, they can be saved into variables using (set:) and (put:), and stored for later use.
		
		Macros that produce commands include (display:), (print:), (go-to:), (save-game:), (load-game:),
		(link-goto:), and more.
		
		Many commands only have an effect when they're attached to hooks, and modify the
		hook in a certain manner. Macros that work like this include (text-style:), (font:), (transition:),
		(rotate:), (position-x:), (position-y:), (hook:), (click:), (link:), and more.
	*/
	var
		Any = Macros.TypeSignature.Any,
		optional = Macros.TypeSignature.optional;
	
	var hasStorage = !!localStorage
		&& (function() {
			/*
				This is, to my knowledge, the only surefire way of measuring localStorage's
				availability - on some browsers, setItem() will throw in Private Browsing mode.
			*/
			try {
				localStorage.setItem("test", '1');
				localStorage.removeItem("test");
				return true;
			} catch (e) {
				return false;
			}
		}());
	
	Macros.add
	
		/*d:
			(display: String) -> Command
			
			This command writes out the contents of the passage with the given string name.
			If a passage of that name does not exist, this produces an error.
			
			Example usage:
			`(display: "Cellar")` prints the contents of the passage named "Cellar".
			
			Rationale:
			Suppose you have a section of code or prose that you need to include in several different
			passages. It could be a status display, or a few lines of descriptive text. Instead of
			manually copy-pasting it into each passage, consider placing it all by itself in another passage,
			and using (display:) to place it in every passage. This gives you a lot of flexibility: you can,
			for instance, change the code throughout the story by just editing the displayed passage.
			
			Details:
			Text-targeting macros (such as (replace:)) inside the
			displayed passage will affect the text and hooks in the outer passage
			that occur earlier than the (display:) command. For instance,
			if passage A contains `(replace:Prince)[Frog]`, then another passage
			containing `Princes(display:'A')` will result in the text `Frogs`.
			
			When set to a variable, it evaluates to a DisplayCommand, an object
			which is by-and-large unusable as a stored value, but activates
			when it's placed in the passage.
		*/
		("display", function display(_, name) {
			/*
				Create a DisplayCommand.
			*/
			return {
				TwineScript_ObjectName:
					"a (display: " + Utils.toJSLiteral(name) + ") command",
				
				TwineScript_TypeName:
					"a (display:) command",
				
				TwineScript_Print: function() {
					/*
						Test for the existence of the named passage in the story.
						This and the next check must be made now, because the Passages
						datamap could've been tinkered with since this was created.
					*/
					var error;
					if ((error = TwineError.containsError(State.passageExists(name)))) {
						return error;
					}
					return Utils.unescape(State.variables.Passages.get(name).get('prose'));
				},
			};
		},
		[String])
		
		/*d:
			(print: Any) -> Command
			This command prints out any single argument provided to it, as text.
			
			Example usage:
			`(print: $var)`
			
			Details:
			It is capable of printing things which (text:) cannot convert to a string,
			such as changer commands - but these will usually become bare descriptive
			text like `[A (font: ) command]`. But, for debugging purposes this can be helpful.
			
			When set to a variable, it evaluates to a PrintCommand. Notably, the
			expression to print is stored in the PrintCommand. So, a passage
			that contains:
			```
			(set: $name to "Dracula")
			(set: $p to (print: "Count " + $name))
			(set: $name to "Alucard")
			$p
			```
			will still result in the text `Count Dracula`. This is not particularly useful
			compared to just setting `$p` to a string, but is available nonetheless.
			
			See also:
			(text:), (display:)
		*/
		("print", function print(_, expr) {
			
			/*
				If an error was passed in, return the error now.
			*/
			if (TwineError.containsError(expr)) {
				return expr;
			}
			if (expr && typeof expr.TwineScript_Print === "function") {
				expr = expr.TwineScript_Print();
			}
			else if (expr instanceof Map) {
				/*
					In accordance with arrays being "pretty-printed" to something
					vaguely readable, let's pretty-print datamaps into HTML tables.
					
					First, convert the map into an array of key-value pairs.
				*/
				expr = Array.from(expr.entries());
				if (TwineError.containsError(expr)) {
					return expr;
				}
				expr = expr.reduce(function(html, pair) {
					/*
						Print each value, recursively running (print:) on
						each of them. Notice that the above conversion means
						that none of these pairs contain error.
					*/
					return html + "<tr><td>" +
						print(_, pair[0]).TwineScript_Print() +
						"</td><td>" +
						print(_, pair[1]).TwineScript_Print() +
						"</td></tr>";
					
				}, "<table class=datamap>") + "</table>";
			}
			else if (expr instanceof Set) {
				/*
					Sets are close enough to arrays that we might as well
					just pretty-print them identically.
				*/
				expr = Array.from(expr.values());
			}
			else if (Array.isArray(expr)) {
				expr += "";
			}
			/*
				If it's an object we don't know how to print, emit an error
				instead of [object Object].
			*/
			else if (OperationUtils.isObject(expr)) {
				return TwineError.create("unimplemented", "I don't know how to print this value yet.");
			}
			/*
				At this point, primitives have safely fallen through.
			*/
			else {
				expr += "";
			}
			
			return {
				TwineScript_ObjectName:
					"a (print: " + Utils.toJSLiteral(expr) + ") command",

				TwineScript_TypeName:
					"a (print:) command",
				
				TwineScript_Print: function() {
					return expr;
				},
			};

		},
		[Any])
		
		/*d:
			(go-to: String) -> Command
			This command stops passage code and sends the player to a new passage.
			If the passage named by the string does not exist, this produces an error.
			
			Example usage:
			`(go-to: "The Distant Future")`
			
			Rationale:
			There are plenty of occasions where you may want to instantly advance to a new
			passage without the player's volition. (go-to:) provides access to this ability.
			
			(go-to:), as with all macros, can accept any expression which evaluates to
			a string. You can, for instance, go to a randomly selected passage by combining it with
			(either:) - `(go-to: (either: "Win", "Lose", "Draw"))`.
			
			(go-to:) can be combined with (link:) to produce a structure not unlike a
			normal passage link: `(link:"Enter the hole")[(go-to:"Falling")]` However, you
			can include other macros inside the hook to run before the (go-to:), such as (set:),
			(put:) or (save-game:).
			
			Details:
			(go-to:) prevents any macros and text after it from running.
			So, a passage that contains:
			```
			(set: $listen to "I love")
			(go-to: "Train")
			(set: $listen to it + " you")
			```
			will *not* cause `$listen` to become `"I love you"` when it runs.
			
			Going to a passage using this macro will count as a new "turn" in the game's passage history,
			much as if a passage link was clicked.
			
			See also:
			(loadgame:)
		*/
		("goto", function (_, name) {
			return {
				TwineScript_ObjectName: "a (go-to: " + Utils.toJSLiteral(name) + ") command",
				TwineScript_TypeName:   "a (go-to:) command",
				TwineScript_Print: function() {
					/*
						First, of course, check for the passage's existence.
					*/
					var error = TwineError.containsError(State.passageExists(name));
					if (error) {
						return error;
					}
					/*
						When a passage is being rendered, <tw-story> is detached from the main DOM.
						If we now call another Engine.goToPassage in here, it will attempt
						to detach <tw-story> twice, causing a crash.
						So, the change of passage must be deferred until just after
						the passage has ceased rendering.
					*/
					requestAnimationFrame(Engine.goToPassage.bind(Engine,name));
					/*
						But how do you immediately cease rendering the passage?
						
						This object's property name causes Section's runExpression() to
						cancel expression evaluation at that point. This means that for, say,
							(goto: "X")(set: $y to 1)
						the (set:) will not run because it is after the (goto:)
					*/
					return { earlyExit: 1 };
				},
			};
		},
		[String])
		
		/*d:
			(live: [Number]) -> Command
			When you attach this macro to a hook, the hook becomes "live", which means that it's repeatedly re-run
			every certain number of milliseconds, replacing the prose inside of the hook with a newly computed version.
			
			Example usage:
			```
			{(live: 0.5s)[
			    (either: "Bang!", "Kaboom!", "Whammo!", "Pow!")
			]}
			```
			
			Rationale:
			Twine passage text generally behaves like a HTML document: it starts as code, is changed into a
			rendered page when you "open" it, and remains so until you leave. But, you may want a part of the
			page to change itself before the player's eyes, for its code to be re-renders "live"
			in front of the player, while the remainder of the passage remains the same.
			
			Certain macros, such as the (link:) macro, allow a hook to be withheld until after an element is
			interacted with. The (live:) macro is more versatile: it re-renders a hook every specified number of
			milliseconds. If (if:) or (unless:) macros are inside the hook, they of course will be re-evaluated each time.
			By using these two kinds of macros, you can make a (live:) macro repeatedly check if an event has occurred, and
			only change its text at that point.
			
			Details:
			Live hooks will continue to re-render themselves until they encounter and print a (stop:) macro.
		*/
		/*
			Yes, the actual implementation of this is in Section, not here.
		*/
		("live",
			function live(_, delay) {
				return {
					TwineScript_ObjectName: "a (live: " + delay + ") command",
					TwineScript_TypeName:   "a (live:) command",
					live: true,
					delay: delay
				};
			},
			[optional(Number)]
		)
		
		/*d
			(stop:) -> Command
			This macro, which accepts no arguments, creates a (stop:) command, which is not configurable.
			
			Example usage:
			```
			{(live: 1s)[
			    (if: $packedBags)[OK, let's go!(stop:)]
			    (else: )[(either:"Are you ready yet?","We mustn't be late!")]
			]}
			```
			
			Rationale:
			Clunky though it looks, this macro serves a single important purpose: inside a (live:)
			macro's hook, its appearance signals that the macro must stop running. In every other occasion,
			this macro does nothing.
			
			See also:
			(live:)
		*/
		("stop",
			function stop() {
				return {
					TwineScript_ObjectName: "a (stop:) command",
					TwineScript_TypeName:   "a (stop:) command",
					TwineScript_Print: function() {
						return "";
					},
				};
			},
			[]
		)
		/*d:
			(save-game: String, [String]) -> Boolean
			
			This macro saves the current game's state in browser storage, in the given save slot,
			and including a special filename. It can then be restored using (load-game:).
			
			Rationale:
			
			Many web games use browser cookies to save the player's place in the game.
			Twine allows you to save the game, including all of the variables that were (set:)
			or (put:), and the passages the player visited, to the player's browser storage.
			
			(save-game:) is a single operation that can be used as often or as little as you
			want to. You can include it on every page; You can put it at the start of each "chapter";
			You can put it inside a (link:) hook, such as
			```
			{(link:"Save game")[
			  (if:(save-game:"Slot A"))[
			    Game saved!
			  ](else: )[
			    Sorry, I couldn't save your game.
			  ]
			]}
			```
			and let the player choose when to save.
			
			Details:
			
			(save-game:)'s first String is a slot name in which to store the game. You can have as many slots
			as you like. If you only need one slot, you can just call it `"A"` and use `(save-game:"A")`.
			You can tie them to a name the player gives, such as `(save-game: $playerName)`, if multiple players
			are likely to play this game - at an exhibition, for instance.
			
			Giving the saved game a file name is optional, but allows that name to be displayed by finding it in the
			$Saves datamap. This can be combined with a (load-game:)(link:) to clue the players into the save's contents:
			```
			(link: "Load game: " + ("Slot 1") of Saves)[
			  (load-game: "Slot 1")
			]
			```
			
			(save-game:) evaluates to a boolean - true if the game was indeed saved, and false if the browser prevented
			it (because they're using private browsing, their browser's storage is full, or some other reason).
			Since there's always a possibility of a save failing, you should use (if:) and (else:) with (save-game:)
			to display an apology message in the event that it returns false (as seen above).
			
			See also:
			(load-game:)
		*/
		("savegame",
			function savegame(_, slotName, fileName) {
				/*
					The default filename is the empty string.
				*/
				fileName = fileName || "";
				
				if (!hasStorage) {
					/*
						If storage isn't available, that's the unfortunate fault of the
						browser. Return false, signifying that the save failed, and
						allowing the author to display an apology message.
					*/
					return false;
				}
				var serialisation = State.serialise();
				if (!serialisation) {
					/*
						On the other hand, if serialisation fails, that's presumably
						the fault of the author, and an error should be given.
					*/
					return TwineError.create(
						"saving",
						"The game's variables contain a complex data structure; the game can no longer be saved."
					);
				}
				/*
					In case setItem() fails, let's run this in a try block.
				*/
				try {
					localStorage.setItem(
						/*
							Saved games are prefixed with (Saved Game) to avoid collisions.
							I'm loathe to use any particular prefix which brands the game
							as a Twine creation: it should be able to stand with its own
							identity, even in an obscure a place as its localStorage key names.
						*/
						"(Saved Game) " + slotName, serialisation);
					
					/*
						The file name is saved separately from the state, so that it can be retrieved
						without having to JSON.parse() the entire state.
					*/
					localStorage.setItem(
						/*
							Saved games are prefixed with (Saved Game Filename) to avoid collisions.
						*/
						"(Saved Game Filename) " + slotName, fileName);
					/*
						Update the $Saves datamap with this change, replacing an existing
						filename if it was there.
					*/
					State.variables.Saves.set(slotName, fileName);
					return true;
				} catch(e) {
					/*
						As above, if it fails, a return value of false is called for.
					*/
					return false;
				}
			},
			[String, optional(String)]
		)
		/*d:
			(load-game: String) -> Command
			
			This command attempts to load a saved game from the given slot, ending the current game and replacing it
			with the loaded one. This causes the passage to change.
			
			Example usage:
			```
			{(if: $Saves contains "Slot A")[
			  (link: "Load game")[(load-game:"Slot A")]
			]}
			```
			
			Details:
			Just as (save-game:) exists to store the current game session, (load-game:) exists to retrieve a past
			game session, whenever you want. This command, when given the string name of a slot, will attempt to
			load the save, completely and instantly replacing the variables and move history with that of the
			save, and going to the passage where that save was made.
			
			This macro assumes that the save slot exists and contains a game, which you can check by seeing if
			`$Saves contains` the slot name before running (load-game:).
			
			See also:
			(save-game:)
		*/
		("loadgame",
			function loadgame(_, slotName) {
				return {
					TwineScript_ObjectName: "a (load-game:) command",
					TwineScript_TypeName:   "a (load-game:) command",
					TwineScript_Print: function() {
						var saveData = localStorage.getItem("(Saved Game) " + slotName);
						
						if (!saveData) {
							return TwineError.create("saving", "I can't find a save slot named '" + slotName + "'!");
						}
						
						State.deserialise(saveData);
						/*
							There's not a strong reason to check for the destination passage existing,
							because (save-game:) can only be run inside a passage. If this fails,
							the save itself is drastically incorrect.
						*/
						requestAnimationFrame(Engine.showPassage.bind(Engine,State.passage));
						return { earlyExit: 1 };
					},
				};
			},
			[String]
		);
});
