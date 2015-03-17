define(['jquery', 'utils', 'renderer'], function($, Utils, Renderer) {
	"use strict";
	/**
		When a new Section (generally a hook or expression) is about to be rendered,
		a ChangeDescriptor is created and fed into all of the ChangerCommands which are
		attached to the Section. They mutate the ChangeDescriptor, and the result describes
		all of the changes that must be made to the Section on rendering.
	*/
	var ChangeDescriptor,
		/*
			changeDescriptorShape is an array of all expected properties on
			ChangeDescriptor instances. It's cached for performance paranoia.
		*/
		changeDescriptorShape;
	
	ChangeDescriptor = {
		
		// A ChangeDescriptor is a TwineScript internal object with the following values:
		
		// {String} prose             The hook's prose, which can be finagled before it is run.
		prose:             "",
		
		// {Boolean} enabled          Whether or not this code is enabled.
		//                            (Disabled code won't be used until something enables it).
		enabled:          true,
		
		// {jQuery} target            Where to render the prose, if not the hookElement.
		target:           null,
		
		// {String} append            Which jQuery method name to append the prose to the dest with.
		append:           "append",
		
		// {String} [transition]      Which built-in transition to use.
		transition:       "instant",
		
		// {Number} [transitionTime]  The duration of the transition, in ms. CURRENTLY UNUSED.
		transitionTime:   0,
		
		// {Array} styles             A set of CSS styles to apply inline to the hook's element.
		//                            Used by (position-x:), etc.
		styles:           null,
		
		// {Object} [attr]            Attributes to apply to the <tw-expression> using $.fn.attr().
		//                            Used only by (hook:).
		attr:             null,
		
		// {Object} [data]            Data to attach to the <tw-expression> using $.fn.attr().
		//                            Used only by (link:).
		data:             null,
		
		// {Object} [section]         A Section that 'owns' this ChangeDescriptor.
		//                            Used by enchantment macros to determine where to register
		//                            their enchantments to.
		section:          null,
		
		/**
			This creates an inheriting ChangeDescriptor, and is basically
			another shorthand for the old create-assign pattern.
			ChangeDescriptors can delegate to earlier descriptors if need be.
		*/
		create: function(properties, changer) {
			var ret = Object.assign(Object.create(this), {
					attr:   [],
					styles: [],
				}, properties);
			/*
				If a ChangerCommand was passed in, run it.
			*/
			if (changer) {
				changer.run(ret);
			}
			return ret;
		},
		
		/**
			This method applies the style/attribute/data entries of this descriptor
			to the target HTML element. It's called whenever $Design is changed.
		*/
		update: function() {
			var target = this.target;
			/*
				Apply the style attributes to the target element.
			*/
			if (Array.isArray(this.styles)) {
				target.css(Object.assign.apply(0, [{}].concat(this.styles)));
			}
			/*
				If HTML attributes were included in the changerDescriptor, apply them now.
			*/
			if (this.attr) {
				this.attr.forEach(function(e) {
					target.attr(e);
				});
			}
			/*
				Same with jQuery data (such as functions to call in event of, say, clicking).
			*/
			if (this.data) {
				target.data(this.data);
			}
		},
		
		/**
			This method renders TwineMarkup, executing the TwineScript expressions
			within. The expressions only have visibility
			within this passage.
			
			@method render
			@return {jQuery} The rendered passage DOM.
		*/
		render: function() {
			var
				target      = this.target,
				prose       = this.prose,
				append      = this.append,
				transition  = this.transition,
				enabled     = this.enabled,
				dom;
			
			Utils.assertOnlyHas(this, changeDescriptorShape);
			
			/*
				First, a quick check to see if this is enabled and with a target.
				If not, assume nothing needs to be done, and return.
			*/
			if (!target || !enabled) {
				return $();
			}
			/*
				Check to see that the given jQuery method in the descriptor
				actually exists, and potentially tweak the name if it does not.
			*/
			if (!(append in target)) {
				/*
					(replace:) should actually replace the interior of the hook with the
					content, not replace the hook itself (which is what .replaceWith() does).
					So, we need to do .empty() beforehand, then change the method to "append"
					(though "prepend" will work too).
				*/
				if (append === "replace") {
					target.empty();
					append = "append";
				}
				/*
					If I wished to add a variant of (replace:) that did remove the entire
					hook, then I'd change append to "replaceWith".
				*/
				else {
					Utils.impossible("Section.render", "The target jQuery doesn't have a '" + append + "' method.");
					return;
				}
			}
			/*
				Render the TwineMarkup prose into a HTML DOM structure.
				
				You may notice that the design of this and renderInto() means
				that, when a HookSet has multiple targets, each target has
				its own distinct rendering of the same TwineMarkup.
				
				(Note: prose may be '' if the descriptor's append method is "remove".
				In which case, let it be an empty set.)
				
				Notice also that the entire expression is wrapped in $():
				a jQuery must be returned by this method, and $(false)
				conveniently evaluates to $().Otherwise, it converts the
				array returned by $.parseHTML into a jQuery.
				
				This has to be run as close to insertion as possible because of
				the possibility of <script> elements being present - 
				$.parseHTML executes scripts immediately on encountering them (if
				the third arg is true) and it wouldn't do to execute them and then
				early-exit from this method.
			*/
			
			dom = $(prose &&
				$.parseHTML(Renderer.exec(prose), document, true));
			
			/*
				Now, insert the DOM structure into the target element.
			
				Here are the reasons why the DOM must be connected to the target before the
				expressions are evaluated:
			
				* Various Twine macros perform DOM operations on this pre-inserted jQuery set of
				rendered elements, but assume that all the elements have a parent item, so that e.g.
				.insertBefore() can be performed on them.
			
				* Also, and perhaps more saliently, the next block uses .find() to select
				<tw-macro> elements etc., which assumes that the jQuery object has a single
				container element at its "root level".
			
				* Finally, sensor macros' interval functions deactivate themselves if the
				section is disconnected from Utils.storyElement, and if they initially
				run without being connected, they will immediately deactivate.
			*/
			target[append](
				// As mentioned above, dom may be empty if append is "remove".
				dom.length ? dom : undefined
			);
			/*
				Apply the style/data/attr attributes to the target element.
			*/
			this.update();

			/*
				Transition it using this descriptor's given transition.
			*/
			if (transition) {
				Utils.transitionIn(
					/*
						There's a slight problem: when we want to replace the
						target, we don't need to apply a transition to every
						element, so we just transition the target itself.
					
						But, when we're *appending* to the target, we don't want
						the existing material in it to be transitioned, so
						then we must resort to transitioning every element.
					
						This is #awkward, I know...
					*/
					append === "replace" ? target : dom,
					transition
				);
			}
			
			return dom;
		}
	};
	changeDescriptorShape = Object.keys(ChangeDescriptor);
	
	return Object.seal(ChangeDescriptor);
});
