define([
	'jquery',
	'utils',
	'utils/selectors',
	'renderer',
	'twinescript/environ',
	'state',
	'utils/hookutils',
	'datatypes/hookset',
	'internaltypes/pseudohookset',
	'internaltypes/changedescriptor',
	'internaltypes/twineerror',
	'internaltypes/twinenotifier',
],
function($, Utils, Selectors, Renderer, Environ, State, HookUtils, HookSet, PseudoHookSet, ChangeDescriptor, TwineError, TwineNotifier) {
	"use strict";

	var Section;

	/**
		Section objects represent a block of Twine prose rendered into the DOM.
		It contains its own DOM, a reference to any enclosing Section,
		and methods and properties related to invoking TwineScript code within it.
		
		The big deal of having multiple Section objects (and the name Section itself
		as compared to "passage" or "screen") is that multiple simultaneous passages'
		(such as (display:)ed passages, or stretchtext mode) code should be
		hygenically scoped. Hook references in one passage cannot affect another,
		and so forth.
		
		@class Section
		@static
	*/
	
	/**
		Apply the result of a <tw-expression>'s evaluation to the next hook.
		If the result is a changer command, live command or boolean, this will cause the hook
		to be rendered differently.
		
		@method runExpression
		@private
		@param {jQuery} expr The <tw-expression> element.
		@param {Any} result The result of running the expression.
	*/
	function applyExpressionToHook(expr, result) {
		/*
			To be considered connected, the next hook must be the very next element.
		*/
		var nextHook = expr.next(Selectors.hook);
		
		/*
			If result is a ChangerCommand, please run it.
		*/
		if (result && result.changer) {
			if (!nextHook.length) {
				expr.replaceWith(TwineError.create("macrocall",
					"The (" + result.macroName + ":) macro should be assigned to a variable or attached to a hook."
				), expr.attr('title'));
			}
			else {
				this.renderInto(
					/*
						The use of popAttr prevents the hook from executing normally
						if it wasn't actually the eventual target of the changer function.
					*/
					nextHook.popAttr('prose'),
					/*
						Don't forget: nextHook may actually be empty.
						This is acceptable - the result changer could alter the
						target appropriately.
					*/
					nextHook,
					result
				);
			}
		}
		/*
			Else, if it's a live macro, please run that.
		*/
		else if (result && result.live) {
			runLiveHook.call(this, nextHook, result.delay, result.event);
		}
		/*
			And finally, the falsy primitive case.
			This is special: as it prevents hooks from being run, an (else:)
			that follows this will return true.
		*/
		else if   (result === false
				|| result === null
				|| result === undefined) {
			nextHook.removeAttr('prose');
			expr.addClass("false");
			
			if (nextHook.length) {
				/*
					Unfortunately, (else-if:) must be special-cased, so that it doesn't affect
					lastHookShown, instead preserving the value of the original (if:).
				*/
				if (Utils.insensitiveName(expr.attr('name')) !== "elseif") {
					this.stack[0].lastHookShown = false;
				}
				return;
			}
		}
		/*
			The (else:) and (elseif:) macros require a little bit of state to be
			saved after every hook interaction: whether or not the preceding hook
			was shown or hidden by the attached expression.
			Sadly, we must oblige with this overweening demand.
		*/
		if (nextHook.length) {
			this.stack[0].lastHookShown = true;
		}
	}
	
	/**
		Run a newly rendered <tw-expression> element's code, obtain the resulting value,
		and apply it to the next <tw-hook> element, if present.
		
		@method runExpression
		@private
		@param {jQuery} expr The <tw-expression> to run.
	*/
	function runExpression(expr) {
		var
			/*
				Execute the expression, and obtain its result value.
			*/
			result = this.eval(expr.popAttr('js') || '');
		
		/*
			Print any error that resulted.
			This must of course run after the sensor/changer function was run,
			in case that provided an error.
		*/
		if (TwineError.containsError(result)) {
			if (result instanceof Error) {
				result = TwineError.fromError(result);
			}
			expr.replaceWith(result.render(expr.attr('title'), expr));
		}
		/*
			If we're in debug mode, a TwineNotifier may have been sent.
			In which case, print that *inside* the expr, not replacing it.
		*/
		else if (TwineNotifier.isPrototypeOf(result)) {
			expr.append(result.render());
		}
		/*
			If the expression had a TwineScript_Print method, do that.
		*/
		else if (result && result.TwineScript_Print && !result.changer) {
			/*
				TwineScript_Print() typically emits side-effects. These
				will occur... now.
			*/
			result = result.TwineScript_Print();
			
			/*
				If TwineScript_Print returns an object of the form { earlyExit },
				then that's a signal to cease all further expression evaluation
				immediately.
			*/
			if (result.earlyExit) {
				return false;
			}
			/*
				On rare occasions (specifically, when the passage component
				of the link syntax produces an error) TwineScript_Print
				returns a jQuery of the <tw-error>.
			*/
			if (result instanceof $) {
				expr.append(result);
			}
			/*
				Alternatively (and more commonly), TwineScript_Print() can
				return an Error object.
			*/
			else if (TwineError.containsError(result)) {
				if (result instanceof Error) {
					result = TwineError.fromError(result);
				}
				expr.replaceWith(result.render(expr.attr('title'), expr));
			}
			else {
				this.renderInto(result, expr);
			}
		}
		/*
			This prints an object if it's a string, number, or has a custom toString method
			and isn't a function.
		*/
		else if (typeof result === "string"  || typeof result === "number"
			|| (typeof result === "object" && result && result.toString !== Object.prototype.toString)) {
			/*
				Transition the resulting Twine code into the expression's element.
			*/
			this.renderInto(result + '', expr);
		}
		else {
			applyExpressionToHook.call(this, expr, result);
		}
	}
	
	/**
		<tw-collapsed> elements should collapse whitespace inside them in a specific manner - only
		single spaces between non-whitespace should remain.
		This function performs this transformation by modifying the text nodes of the passed-in element.
		
		@method collapse
		@private
		@param {jQuery} elem The element whose whitespace must collapse.
	*/
	function collapse(elem) {
		var finalNode, lastVisibleNode;
		/*
			- If the node contains <br>, replace with a single space.
		*/
		elem.find('br').replaceWith(new Text(" "));
		
		finalNode = elem.textNodes().reduce(function(prevNode, node) {
			/*
				- If the node contains runs of whitespace, reduce all runs to single spaces.
				(This reduces nodes containing only whitespace to just a single space.)
			*/
			node.textContent = node.textContent.replace(/\s+/g,' ');
			/*
				- If the node begins with a space and previous node ended with whitespace or is empty, trim left.
				(This causes nodes containing only whitespace to be emptied.)
			*/
			if (node.textContent[0] === " "
					&& (!prevNode || !prevNode.textContent || prevNode.textContent.search(/\s$/) >-1)) {
				node.textContent = node.textContent.slice(1);
			}
			/*
				Save the last visible node for a following step.
			*/
			if (node.textContent && node.textContent.search(/^\s*$/) === -1) {
				lastVisibleNode = node;
			}
			return node;
		}, null);
		/*
			- If this is the final node, trim it right.
			In the case of { <b>A</b> }, the final node is not the last visible node,
			and the last visible node doesn't end with whitespace.
		*/
		if (finalNode) {
			finalNode.textContent = finalNode.textContent.replace(/\s+$/, '');
		}
		/*
			- If the last visible node ends with whitespace, trim it right.
			In the case of { <b>A </b> }, the final node has been trimmed,
			but this one has not.
		*/
		if (lastVisibleNode) {
			lastVisibleNode.textContent = lastVisibleNode.textContent.replace(/\s+$/, '');
		}
		/*
			Now that we're done, normalise the nodes.
		*/
		elem[0].normalize();
	}
	
	/**
		A live hook is one that has the (live:) macro attached.
		It repeatedly re-renders, allowing a passage to have "live" behaviour.
		
		This is exclusively called by runExpression().
		
		@method runLiveHook
		@private
		@param {Function} sensor The sensor function.
		@param {jQuery} target The <tw-hook> that the sensor is connected to.
		@param {Number} delay The timeout delay.
	*/
	function runLiveHook(target, delay) {
		/*
			Remember the code of the hook.
			
			(We also remove (pop) the code from the hook
			so that doExpressions() doesn't render it.)
		*/
		var prose = target.popAttr('prose') || "",
			recursive;
		
		/*
			Default the delay to 20ms if none was given.
		*/
		delay = (delay === undefined ? 20 : delay);
		
		/*
			This closure runs every frame from now on, until
			the target hook is gone.
			
			Notice that as this is bound, giving it a name isn't
			all that useful.
		*/
		recursive = (function() {
			this.renderInto(prose, target, {append:'replace'});
			/*
				The (stop:) command causes the nearest (live:) command enclosing
				it to be stopped. Inside an (if:), it allows one-off live events to be coded.
				If a (stop:) is in the rendering target, we shan't continue running.
			*/
			if (target.find(Selectors.expression + "[name='stop']").length) {
				return;
			}
			/*
				Re-rendering will also cease if this section is removed from the DOM.
			*/
			if (!this.inDOM()) {
				return;
			}
			/*
				Otherwise, resume re-running.
			*/
			setTimeout(recursive, delay);
		}.bind(this));
		
		setTimeout(recursive, delay);
	}
	
	Section = {
		/**
			Creates a new Section which inherits from this one.
			Note: while all Section use the methods on this Section prototype,
			there isn't really much call for a Section to delegate to its
			parent Section.
			
			@method create
			@param {jQuery} newDom The DOM that comprises this section.
			@return {Section} Object that inherits from this one.
		*/
		create: function(dom) {
			var ret;
			
			// Just some overweening type-checking.
			Utils.assert(dom instanceof $ && dom.length === 1);
			
			/*
				Install all of the non-circular properties.
			*/
			ret = Object.assign(Object.create(this), {
				/*
					The time this Section was rendered. Of course, it's
					not been rendered yet, but it needs to be recorded this early because
					TwineScript uses it.
				*/
				timestamp: Date.now(),
				/*
					The root element for this section. Macros, hookRefs, etc.
					can only affect those in this Section's DOM.
				*/
				dom: dom || Utils.storyElement,
				/*
					The expression stack is an array of plain objects,
					each housing runtime data that is local to the expression being
					evaluated. It is used by macros such as "display" and "if" to
					keep track of prior evaluations - e.g. display loops, else().
					
					render() pushes a new object to this stack before
					running expressions, and pops it off again afterward.
				*/
				stack: [],
				/*
					This is an enchantments stack. I'll explain later.
				*/
				enchantments: []
			});
			
			/*
				Add a TwineScript environ and mix in its eval() method.
			*/
			ret = Environ(ret);
			return ret;
		},
		
		/**
			A quick check to see if this section's DOM is connected to the
			story's DOM.
			Currently only used by recursiveSensor().
			
			@method inDOM
		*/
		inDOM: function() {
			return $(Utils.storyElement).find(this.dom).length > 0;
		},

		/**
			This method runs Utils.$ (which is the $ function filtering out transition-out
			elements) with the dom as the context.
			
			@method $
		*/
		$: function(str) {
			return Utils.$(str, this.dom);
		},
		
		/**
			This function allows an expression of TwineMarkup to be evaluated as data, and
			determine the text within it.
			This is currently only used by runLink, to determine the link's passage name.
		
			@method evaluateTwineMarkup
			@private
			@param {String} expr
			@param {String|jQuery} text, or a <tw-error> element.
		*/
		evaluateTwineMarkup: function(expr) {
			/*
				The expression is rendered into this loose DOM element, which
				is then discarded after returning. Hopefully no leaks
				will arise from this.
			*/
			var p = $('<p>'),
				errors;
			
			/*
				Render the text, using this own section as the base (which makes sense,
				as the recipient of this function is usually a sub-expression within this section).
			
				No changers, etc. are capable of being applied here.
			*/
			this.renderInto(expr, p);
			
			/*
				But first!! Pull out any errors that were generated.
			*/
			if ((errors = p.find('tw-error')).length > 0) {
				return errors;
			}
			return p.text();
		},
		
		/**
			This method takes a selector string and selects hooks - usually single <tw-hook>s,
			but also "pseudo-hooks", consecutive text nodes that match the selector -
			querying only this section's DOM and all above it.
			
			This is most commonly invoked by TwineScript's desugaring of the HookRef
			syntax (e.g. "?cupboard" becoming "section.selectHook('?cupboard')").
			
			@method selectHook
			@param {String} selectorString
			@return {HookSet|PseudoHookSet}
		*/
		selectHook: function(selectorString) {
			/*
				If a HookSet or PseudoHookSet was passed in, return it unmodified.
				TODO: Should this be a bug?
			*/
			if (HookSet.isPrototypeOf(selectorString)
				|| PseudoHookSet.isPrototypeOf(selectorString)) {
				return selectorString;
			}
			switch(HookUtils.selectorType(selectorString)) {
				case "hookRef": {
					return HookSet.create(this, selectorString);
				}
				case "string": {
					return PseudoHookSet.create(this, selectorString);
				}
			}
			return null;
		},
		
		/**
			Renders the given TwineMarkup code into a given element,
			transitioning it in. Changer functions can be provided to
			modify the ChangeDescriptor object that controls how the code
			is rendered.
			
			This is used primarily by Engine.showPassage() to render
			passage data into a fresh <tw-passage>, but is also used to
			render TwineMarkup into <tw-expression>s (by runExpression())
			and <tw-hook>s (by render() and runLiveHook()).
			
			@method renderInto
			@param {String} code The TwineMarkup code to render into the target.
			@param target The render destination. Usually a HookSet, PseudoHookSet or jQuery.
			@param {Function|Array} [changers] The changer function(s) to run.
		*/
		renderInto: function(source, target, changers) {
			var
				/*
					This is the ChangeDescriptor that defines this rendering.
				*/
				desc = ChangeDescriptor.create({
					target: target,
					prose: source,
				}),
				/*
					This stores the returned DOM created by rendering the changeDescriptor.
				*/
				dom = $(),
				/*
					This provides (sigh) a reference to this object usable by the
					inner doExpressions function, below.
				*/
				section = this;
				
			/*
				Also define a property linking it back to this section.
				This is used by enchantment macros to determine where to register
				their enchantments to.
			*/
			desc.section = section;
			
			/*
				Run all the changer functions.
				[].concat() wraps a non-array in an array, while
				leaving arrays intact.
			*/
			changers && [].concat(changers).forEach(function(changer) {
				/*
					If a non-changer object was passed in (such as from
					specificEnchantmentEvent()), assign its values,
					overwriting the default descriptor's.
					Honestly, having non-changer descriptor-altering objects
					is a bit displeasingly rough-n-ready, but it's convenient...
				*/
				if (!changer || !changer.changer) {
					Object.assign(desc, changer);
				}
				else {
					changer.run(desc);
				}
			});
			
			/*
				As you know, in TwineScript a pseudo-hook selector is just a
				raw string. Such strings are passed directly to macros, and,
				at that point of execution inside TwineScript.eval, they don't
				have access to a particular section to call selectHook() from.
				
				So, we currently defer creating an array from the selector string
				until just here.
			*/
			if (typeof desc.target === "string") {
				desc.target = this.selectHook(desc.target);
			}
			
			/*
				If there's no target, something incorrect has transpired.
			*/
			if (!desc.target) {
				Utils.impossible("Section.renderInto",
					"ChangeDescriptor has prose but not a target!");
				return;
			}
			
			/*
				Render the prose into the target.
				
				When a non-jQuery is the target in the descriptor, it is bound to be
				a HookSet or PseudoHookSet, and each word or hook within that set
				must be rendered separately. This simplifies the implementation
				of render() considerably.
			*/
			if (!(desc.target instanceof $)) {
				desc.target.forEach(function(e) {
					/*
						Generate a new descriptor which has the same properties
						(rather, delegates to the old one via the prototype chain)
						but has just this hook/word as its target.
						Then, render using that descriptor.
					*/
					dom = dom.add(desc.create({ target: e }).render());
					/*
						Now, apply the system $Design changer commands to the target.
						It may seem counterintuitive that this is done after initial rendering,
						but remember: inline changers are executed in separate Sections,
						and as such will override these by themselves.
					*/
					State.variables.Design.applyDesign(e);
				});
			}
			else {
				/*
					Now, run the changer.
				*/
				dom = desc.render();
				/*
					As described above, we now apply the $Design changers.
				*/
				State.variables.Design.applyDesign(desc.target);
			}
			
			/*
				Before executing the expressions, put a fresh object on the
				expression data stack.
			*/
			this.stack.unshift(Object.create(null));
			
			/*
				Execute the expressions immediately.
			*/
			
			Utils.findAndFilter(dom, [Selectors.hook, Selectors.expression, Selectors.collapsed]+'')
					.each(function doExpressions () {
				var expr = $(this);
				
				switch(expr.tag()) {
					case Selectors.hook:
					{
						if (expr.attr('prose')) {
							section.renderInto(expr.attr('prose'), expr);
							expr.removeAttr('prose');
						}
						break;
					}
					case Selectors.expression:
					{
						/*
							If this returns false, then the entire .each() loop
							will terminate, thus halting expression evaluation.
						*/
						return runExpression.call(section, expr);
					}
					case Selectors.collapsed:
					{
						collapse(expr);
						break;
					}
				}
			});
			
			/*
				After evaluating the expressions, pop the expression data stack.
				The data is purely temporary and can be safely discarded.
			*/
			this.stack.shift();
			
			/*
				Finally, update the enchantments now that the DOM is modified.
				We should only run updateEnchantments in the "top level" render call,
				to save on unnecessary DOM mutation.
				This can be determined by just checking that this Section's stack is empty.
			*/
			if (this.stack.length === 0) {
				this.updateEnchantments();
			}
		},
		
		/**
			Updates all enchantments in the section. Should be called after every
			DOM manipulation within the section (such as, at the end of .render()).

			@method updateEnchantments
		*/
		updateEnchantments: function () {
			this.enchantments.forEach(function(e) {
				/*
					This first method removes old <tw-enchantment> elements...
				*/
				e.refreshScope();
				/*
					...and this one adds new ones.
				*/
				e.enchantScope();
			});
		},
		
	};
	
	return Object.preventExtensions(Section);
});
