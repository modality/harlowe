define(['jquery'], function($) {
	"use strict";
	$.prototype.extend({
		/*
			popAttr: returns an attribute while removing it. Accepts only 1 argument.
		*/
		popAttr: function(attr) {
			var ret = this.attr(attr);
			this.removeAttr(attr);
			return ret;
		},
		/*
			popAttr: return data while removing it. Accepts only 1 argument.
		*/
		popData: function(name) {
			var ret = this.data(name);
			this.removeData(name);
			return ret;
		},
		/*
			tag: returns the **lowercase** tag name of the first matched element.
			This is only a getter.
		*/
		tag: function() {
			return this[0] && this[0].tagName && this[0].tagName.toLowerCase();
		},

		/*
			This slightly complicated procedure is necessary to select all
			descendent text nodes.
			This returns a sorted Array.
		*/
		textNodes: function() {
			/*
				First, create an array containing all descendent and contents nodes
				which are text nodes.
			*/
			return Array.apply(0, $(this).find('*').addBack().contents().filter(function() {
				return this.nodeType === Node.TEXT_NODE;
			}))
			/*
				the addBack() call adds back the descendents in an unwanted order, so we must
				sort the returned array using compareDocumentPosition.
			*/
			.sort(function(left, right) {
				return (left.compareDocumentPosition(right)) === 2 ? 1 : -1;
			});
		},
		
	});
});
