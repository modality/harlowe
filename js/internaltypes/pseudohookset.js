define(['jquery', 'utils/hookutils'],function($, HookUtils) {
	"use strict";
	
	/**
		A PseudoHookSet represents a "pseudo-hook", which selects
		section text using a search string, rather than a hook tag reference.
		A macro instantiation like...
			remove("cats")
		...would make a pseudo-hook that matches, or "hooks", every instance of
		the string "cats" in the passage. So, without needing to mark up
		that text with hook syntax, the author can still manipulate it intuitively.
		This is a powerful construct!
		
		PseudoHookSets, like HookSets, are exclusively created by Section.selectHook.
		But, unlike the former, they cannot be created as literals - only as a by-product
		of providing a string to certain enchantment macros. Hence, they are unobservable
		by the author, and have no TwineScript methods.
		
		@class PseudoHookSet
		@static
	*/
	var PseudoHookSet = Object.freeze({
		/**
			An Array forEach-styled iteration function. This wraps all
			matched words in the section DOM with a temporary element,
			then calls the passed function for each element.
			
			This is currently just used by Section.renderInto to iterate
			over each word and render it individually.
			
			@method forEach
			@param {Function} fn The callback, which is passed the following:
			@param {jQuery} The <tw-pseudo-hook> element to manipulate.
		*/
		forEach: function(fn) {
			/*
				This is a bit of a #kludge, but no better solution
				exists. In order for DOM replacement jQuery methods
				to work reliably on the entire word, a temporary wrapper
				element must be placed around the 1+ text nodes comprising
				it, thus giving it a solid DOM parentage base.
				
				HookSet, of course, can simply use the <tw-hook> elements
				that already exist. As symmetry with that, the element name
				used here is <tw-pseudo-hook>.
			*/
			var e = HookUtils.wrapTextNodes(this.selector, this.section.dom, '<tw-pseudo-hook>').parent();
			/*
				Now, call the passed function on all of the <tw-pseudo-hook> elements.
			*/
			e.each(function(i){ fn($(this), i); });
			/*
				Having done that, we now remove the <tw-pseudo-hook> elements and normalize
				the text nodes that were split up as a result of the 
			*/
			e.contents().unwrap().parent().each(function() {
				this.normalize();
			});
		},
		
		/**
			Creates a new PseudoHookSet. It has a selector and a section
			which determine what words to select, and from where.
			
			@method create
			@param {Section} section The section to use for DOM lookups.
			@param {String} pseudoHookSelector The selector string.
		*/
		create: function(section, pseudoHookSelector) {
			var ret = Object.create(this);
			
			ret.section = section;
			ret.selector = pseudoHookSelector;
			return ret;
		}
	});
	return PseudoHookSet;
});
