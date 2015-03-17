define(['jquery', 'utils', 'utils/selectors', 'internaltypes/changedescriptor'], function($, Utils, Selectors, ChangeDescriptor) {
	"use strict";
	/**
		$Design
		A userland registry of ChangerCommands which are used to style Twine page elements without needing CSS.
		
		@class $Design
		@static
	*/
	
	/*
		This implements the HoveredLinks style: since it's not possible to target
		a :hover style via inline CSS, it must be implemented using JS instead.
	*/
	$(Utils.storyElement).on('mouseenter', Selectors.internalLink, function() {
		var changer = Design.get("Hovering Links"),
			elem = $(this);
		/*
			Don't apply the changer if A) it doesn't exist, or
			B) the element is being hovered over already.
		*/
		if (changer && !elem.attr("data-mouseleave-style")) {
			/*
				Stash the present style string in a jQuery data store,
				to be restored by the mouseleave event.
			*/
			elem.data("data-mouseleave-style", elem.attr("style") || " ");
			/*
				Apply the changer.
			*/
			ChangeDescriptor.create({target:elem}, changer).update();
		}
	}).on('mouseleave', Selectors.internalLink, function() {
		var elem = $(this);
		elem.attr("style", elem.popData("data-mouseleave-style"));
	});
	
	var Design = Object.assign(new Map([
		["Passages",      null],
		["Page",          null],
		["Links",         null],
		["Hovering Links",null],
	]), {
		/*
			This expando property means that VarRef's objectOrMapSet() cannot
			add properties to it.
		*/
		TwineScript_Sealed: true,
		
		TwineScript_ObjectName: "the $Design datamap",
		/*
			This overload of Map.prototype.set() allows the Passage or Page
			to automatically be updated whenever they are changed.
		*/
		set: function(prop) {
			var ret = Map.prototype.set.apply(this, arguments);
			/*
				This call applies the changed style (and only it) immediately.
			*/
			this.applyDesign(Utils.storyElement, prop);
			return ret;
		},
		
		/*
			Apply the system-wide $Design designs to the elements inside the given element.
			If no property name is given, apply all of the styles. Otherwise,
			apply just the style named by the property.
		*/
		applyDesign: function(elem, prop) {
			/*
				Apply a single style to a certain kind of element.
				"Passages" applies to <tw-passage>s, "Links" applies to
				<tw-link>s, etc.
			*/
			function applyStyle(changer, name) {
				if (!changer) {
					return;
				}
				switch(name) {
					case "Page":
						ChangeDescriptor.create({target:Utils.storyElement}, changer).update();
						break;
					case "Passages":
						ChangeDescriptor.create({target:Utils.findAndFilter(elem, Selectors.passage)}, changer).update();
						break;
					case "Links":
						ChangeDescriptor.create({target:Utils.findAndFilter(elem, Selectors.internalLink)}, changer).update();
						break;
				}
			}
			if (prop) {
				applyStyle(this.get(prop), prop);
			}
			else {
				this.forEach(applyStyle);
			}
		}
	});
	
	return Design;
});
