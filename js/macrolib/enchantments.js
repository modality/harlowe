define(['jquery', 'utils', 'macros', 'datatypes/hookset', 'datatypes/changercommand'],
function($, Utils, Macros, HookSet, ChangerCommand) {
	"use strict";
	/*
		Built-in Revision, Interaction and Enchantment macros.
		This module modifies the Macros module only, and exports nothing.
	*/

	/*
		Revision macros produce ChangerCommands that redirect where the attached hook's
		text is rendered - usually rendering inside an entirely different hook.
	*/
	var
		either = Macros.TypeSignature.either,
		
		revisionTypes = [
			// (replace:)
			// A macro that replaces the scope element(s) with its contents.
			"replace",
			// (append:)
			// Similar to replace, but appends the contents to the scope(s).
			"append",
			// (prepend:)
			// Similar to replace, but prepends the contents to the scope(s).
			"prepend"
		];
	
	revisionTypes.forEach(function(e) {
		Macros.addChanger(e,
			function(_, scope) {
				return ChangerCommand.create(e, [scope]);
			},
			function(desc, scope) {
				desc.target = scope;
				desc.append = e;
				return desc;
			},
			either(HookSet,String)
		);
	});
	
	/*
		This large routine generates functions for enchantment macros, to be applied to
		Macros.addChanger().
		
		An "enchantment" is a process by which selected hooks in a passage are
		automatically wrapped in <tw-enchantment> elements that have certain styling classes,
		and can trigger the rendering of the attached TwineMarkup prose when they experience
		an event.
		
		In short, it allows various words to become links etc., and do something when
		they are clicked, just by deploying a single macro instantiation! Just type
		"(click:"house")[...]", and every instance of "house" in the section becomes
		a link that does something.
		
		The enchantDesc object is a purely internal structure which describes the
		enchantment. It contains the following:
		
		* {String} event The DOM event that triggers the rendering of this macro's contents.
		* {String} classList The list of classes to 'enchant' the hook with, to denote that it
		is ready for the player to trigger an event on it.
		* {String} rerender Determines whether to clear the span before rendering into it ("replace"),
		append the rendering to its current contents ("append") or prepend it ("prepend").
		Only used for "combos", like click-replace().
		* {Boolean} once Whether or not the enchanted DOM elements can trigger this macro
		multiple times.
		
		@method newEnchantmentMacroFns
		@param  {Function} innerFn       The function to perform on the macro's hooks
		@param  {Object}  [enchantDesc]  An enchantment description object, or null.
		@return {Function[]}             A pair of functions.
	*/
	function newEnchantmentMacroFns(enchantDesc, name) {
		// enchantDesc is a mandatory argument.
		Utils.assert(enchantDesc);
		
		/*
			Register the event that this enchantment responds to
			in a jQuery handler.
			
			Sadly, since there's no permitted way to attach a jQuery handler
			directly to the triggering element, the "actual" handler
			is "attached" via a jQuery .data() key, and must be called
			from this <html> handler.
		*/
		$(function() {
			$(Utils.storyElement).on(
				/*
					Put this event in the "enchantment" jQuery event
					namespace, solely for personal tidiness.
				*/
				enchantDesc.event + ".enchantment",
			
				// This converts a HTML class attribute into a CSS selector
				"." + enchantDesc.classList.replace(/ /g, "."),
			
				function generalEnchantmentEvent() {
					var enchantment = $(this),
						/*
							Run the actual event handler.
						*/
						event = enchantment.data('enchantmentEvent');
				
					if (event) {
						event(enchantment);
					}
				}
			)
		});
		
		/*
			Return the macro function AND the ChangerCommand function.
			Note that the macro function's "selector" argument
			is that which the author passes to it when invoking the
			macro (in the case of "(macro: ?1)", selector will be "?1").
		*/
		return [
			function enchantmentMacroFn(_, selector) {
				/*
					If the selector is a HookRef (which it usually is), we must unwrap it
					and extract its plain selector string, as this ChangerCommand
					could be used far from the hooks that this HookRef selects,
					and we'll need to re-run the desc's section's selectHook() anyway.
				*/
				if (selector.selector) {
					selector = selector.selector;
				}
				return ChangerCommand.create(name, [selector]);
			},
			/*
				This ChangerCommand registers a new enchantment on the Section that the
				ChangeDescriptor belongs to.
				
				It must perform the following tasks:
				1. Silence the passed-in ChangeDescriptor.
				2. Call Section.selectHook() to find which hooks are
				selected by the given selector.
				3. Set up the <tw-enchantment> elements around the hooks.
				4. Affix an enchantment event function (that is, a function to run
				when the enchantment's event is triggered) to the <tw-enchantment> elements.
				5. Provide an API for refreshing/resetting the enchantment's
				<tw-enchantment> elements to the Section (usually performing steps
				2-4 again).
				
				You may notice most of these are side-effects to a changer function's
				proper task of altering a ChangeDescriptor. Alas... it is something of
				a #kludge that it piggybacks off the changer macro concept.
			*/
			function makeEnchanter(desc, selector) {
				var enchantData,
					/*
						The scope is shared with both enchantData methods:
						refreshScope removes the <tw-enchantment> elements
						set on the scope, and enchantScope creates an updated
						scope to enchant.
					*/
					scope,
					/*
						A store for the <tw-enchantment> wrappers created
						by enchantScope. Used by the enchantment's event function.
						
						This is a case of a jQuery object being used as a
						data structure rather than as a query result set.
						Search function calls for DOM elements 'contained' in
						these enchantments is more succinct using jQuery
						than using a plain Array or Set.
					*/
					enchantments = $();
				
				/*
					Prevent the target's prose from running immediately.
					This is unset when the event is finally triggered.
				*/
				desc.enabled = false;
				
				/*
					If a rerender method was specified, then this is a "combo" macro,
					which will render its hook's code into a separate target.
					
					Let's modify the descriptor to use that target and render method.
					(Yes, the name "rerender" is #awkward.)
				*/
				if (enchantDesc.rerender) {
					desc.target = selector;
					desc.append = enchantDesc.rerender;
				}
				
				/*
					This enchantData object is stored in the descriptor's Section's enchantments
					list, to allow the Section to easily enchant and re-enchant this
					scope whenever its DOM is altered (e.g. words matching this enchantment's
					selector are added or removed from the DOM).
				*/
				enchantData = {
				
					/*
						This method enchants the scope, applying the macro's enchantment's
						classes to the matched elements.
					*/
					enchantScope: function () {
						/*
							Create the scope, which is a HookSet or PseudoHookSet
							depending on the selector.
						*/
						scope = desc.section.selectHook(selector);
						/*
							In the unlikely event that no scope could be created, call it quits.
							Q: should it make a fuss?
						*/
						if (!scope) {
							return;
						}
						/*
							Reset the enchantments store, to prepare for the insertion of
							a fresh set of <tw-enchantment>s.
						*/
						enchantments = $();
						
						/*
							Now, enchant each selected word or hook within the scope.
						*/
						scope.forEach(function(e) {
							var wrapping;
							
							/*
								Create a fresh <tw-enchantment>, and wrap the elements in it.
							*/
							e.wrapAll("<tw-enchantment class='"
								+ enchantDesc.classList +"'>");
							/*
								It's a little odd that the generated wrapper must be retrieved in
								this roundabout fashion, but oh well.
							*/
							wrapping = e.parent();
							
							/*
								Store the wrapping in the Section's enchantments list.
							*/
							enchantments = enchantments.add(wrapping);
							/*
								Affix to it an event function, to run when it experiences the
								enchantment event.
								
								Alas, this is a #kludge to allow the jQuery event handler
								function above to access this inner data (as in, call this.event).
							*/
							e.parent().data('enchantmentEvent',
								function specificEnchantmentEvent() {
									var index;
									if (enchantDesc.once) {
										/*
											Remove this enchantment from the Section's list.
										*/
										index = desc.section.enchantments.indexOf(enchantData);
										desc.section.enchantments.splice(index,1);
										/*
											Of course, the <tw-enchantment>s
											must also be removed.
										*/
										enchantData.refreshScope();
									}
									/*
										At last, the target originally specified
										by the ChangeDescriptor can now be filled with the
										ChangeDescriptor's original prose.
										
										By passing the desc as the third argument,
										all its values are assigned, not just the target.
										The second argument may be extraneous. #awkward
									*/
									desc.section.renderInto(
										desc.prose,
										null,
										Object.assign({}, desc, { enabled: true })
									);
								}
							);
						});
					},
					/*
						This method refreshes the scope to reflect the current passage DOM state.
					*/
					refreshScope: function () {
						/*
							Clear all existing <tw-enchantment> wrapper elements placed by
							the previous call to enchantScope().
						*/
						enchantments.each(function() {
							$(this).contents().unwrap();
						});
					}
				};
				/*
					Add the above object to the section's enchantments.
				*/
				desc.section.enchantments.push(enchantData);
				/*
					Enchant the scope for the first time.
				*/
				enchantData.enchantScope();
				return desc;
			},
			either(HookSet,String)
		];
	}
	
	/*
		Interaction macros produce ChangerCommands that defer their attached
		hook's rendering, and enchantment a target hook, waiting for the
		target to be interacted with and then performing the deferred rendering.
	*/
	var interactionTypes = [
		// (click:)
		// Reveal the enclosed hook only when the scope is clicked.
		{
			name: "click",
			enchantDesc: {
				event: "click",
				once: true,
				rerender: "",
				classList: "link enchantment-link"
			}
		},
		// (mouseover:)
		// Perform the enclosed macros when the scope is moused over.
		{
			name: "mouseover",
			enchantDesc: {
				event: "mouseenter",
				once: true,
				rerender: "",
				classList: "enchantment-mouseover"
			}
		},
		// (mouseout:)
		// Perform the enclosed macros when the scope is moused away.
		{
			name: "mouseout",
			enchantDesc: {
				event: "mouseleave",
				once: true,
				rerender: "",
				classList: "enchantment-mouseout"
			}
		}
	];
	
	//TODO: (hover:)
	
	interactionTypes.forEach(function(e) {
		Macros.addChanger.apply(0, [e.name].concat(newEnchantmentMacroFns(e.enchantDesc, e.name)));
	});

	
	/*
		Combos are shorthands for interaction and revision macros that target the same hook:
		for instance, (click: ?1)[(replace:?1)[...]] can be written as (click-replace: ?1)[...]
	*/
	revisionTypes.forEach(function(revisionType) {
		interactionTypes.forEach(function(interactionType) {
			var enchantDesc = Object.assign({}, interactionType.enchantDesc, {
					rerender: revisionType
				}),
				name = interactionType.name + "-" + revisionType;
			Macros.addChanger.apply(0, [name].concat(newEnchantmentMacroFns(enchantDesc, name)));
		});
	});
});
