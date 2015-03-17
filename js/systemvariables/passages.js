define(['jquery', 'utils', 'utils/selectors'], function($, Utils, Selectors) {
	"use strict";
	/**
		$Passages
		A userland registry of Passage objects.
		
		@class $Passages
		@static
	*/
	
	/*
		Passage objects are simple Maps.
	*/
	function passage(elem) {
		return Object.assign(new Map([
			/*
				Passage objects have the following properties:
				prose: the raw TwineMarkup prose of the passage.
			*/
			["prose", Utils.unescape(elem.html())],
			/*
				tags: an array of its tags, as strings.
			*/
			["tags", (elem.attr('tags') || "").split(/\s/)],
			/*
				name: its name, which can be altered to change how
				passage links can refer to this (!!!).
				
				Sadly, it's not yet possible to rebind this within $Passages
				just by changing this attribute.
			*/
			["name", elem.attr('name')],
		]),{
			TwineScript_TypeName: "passage datamap",
			TwineScript_ObjectName: "a passage datamap",
			/*
				This does not have TwineScript_Sealed because I want
				authors to be able to dynamically modify passages at runtime.
			*/
		});
	}
	
	var Passages = Object.assign(new Map(), {
		TwineScript_ObjectName: "the $Passages datamap",
		
		/*
			This method retrieves passages which have a given tag.
		*/
		getTagged: function(tag) {
			var ret = [];
			this.forEach(function(v) {
				/*
					We need this instanceof check in case a non-datamap was added by the author.
				*/
				var tags = v instanceof Map && v.get('tags');
				if (Array.isArray(tags) && tags.indexOf(tag) >-1) {
					ret.push(v);
				}
			});
			return ret.sort(function(left, right) {
				return left.get('name') > right.get('name');
			});
		},
	});
	
	/*
		Unfortunately, the DOM isn't visible until the page is loaded, so we can't
		read every <tw-passagedata> from the <tw-storydata> HTML and store them in Passages until then.
	*/
	$(document).ready(function() {
		Array.from($(Selectors.storyData + " > " + Selectors.passageData)).forEach(function(e) {
			e = $(e);
			Passages.set(e.attr('name'), passage(e));
		});
	});
	return Passages;
});
