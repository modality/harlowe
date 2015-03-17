define(['jquery', 'utils', 'utils/selectors'], function($, Utils, Selectors) {
	"use strict";
	
	/**
		HookUtils contains a number of utility methods which are only of use to
		Section, but which are generic enough, and related to specifications of
		what a hook is, to be bundled into this separate class.
		
		@class HookUtils
		@static
	*/

	/*
		Retrieves a substring from a text node by slicing it into (at most 3) parts,
		specified by the inclusive start and non-inclusive end indices.
	*/
	function sliceNode(node, start, end) {
		/*
			We need to cache the length here, as the node is transformed
			by the subsequent splitText calls.
		*/
		var l = node.textContent.length;
		/*
			Of course, we can't omit simple range checks before going further.
		*/
		if (start >= l) {
			return;
		}
		/*
			Now, we do the first split, separating the start of the node
			from the start of the substring.
			(We skip this if the substring is at the start, as splitting
			will create a 0-char text node.)
		*/
		var newNode, ret = [(newNode = (start === 0 ? node : node.splitText(start)))];
		if (end) {
			/*
				This function supports negative end indices, using the
				following quick conversion:
			*/
			if (end <= 0) {
				end = l - end;
			}
			/*
				If that conversion causes end to become equal to l, we
				don't bother (as it will create another 0-char text node).
			*/
			if (end < l) {
				/*
					Otherwise, the split will be performed.
					Note that this returns the rightmost portion of the split,
					i.e. from the end of the substring onwards.
				*/
				ret.push(newNode.splitText(end - start));
			}
		}
		return ret;
	}
	
	/*
		This complicated function takes an array of contiguous sequential
		text nodes, and a search string, and does the following:
		
		1. Finds all occurrences of the search string in the sequence,
		even where the string spans multiple text nodes,
		
		2. Splits the nodes along the occurrences of the string, and
		then returns these split-off nodes.
		
		The purpose of this is to allow transformations of exact
		textual matches within passage text, *regardless* of the
		actual DOM hierarchy which those matches bestride.
	*/
	function findTextInNodes(textNodes, searchString) {
		var
			/*
				examinedNodes holds the text nodes which are currently being
				scrutinised for any possibility of holding the search string.
			*/
			examinedNodes = [],
			/*
				examinedText holds the textContent of the entire set of
				examinedNodes, for easy comparison and inspection.
			*/
			examinedText = '',
			/*
				ret is the returned array of split-off text nodes.
			*/
			ret = [],
			/*
				And these are just hoisted junk.
			*/
			index, remainingLength, slices;
		
		/*
			First, if either search set is 0, return.
		*/
		if (!textNodes.length || !searchString) {
			return ret;
		}
		/*
			We progress through all of the text nodes.
		*/
		while(textNodes.length > 0) {
			/*
				Add the next text node to the set of those being examined.
			*/
			examinedNodes.push(textNodes[0]);
			examinedText += textNodes[0].textContent;
			textNodes.shift();
			
			/*
				Now, perform the examination: does this set of nodes contain the string?
			*/
			index = examinedText.indexOf(searchString);
			/*
				If so, proceed to extract the substring.
			*/
			if (index > -1) {
				remainingLength = examinedText.length - (index + searchString.length);
				/*
					First, remove all nodes which do not contain any
					part of the search string (as this algorithm scans left-to-right
					through nodes, these will always be in the left portion of the
					examinedNodes list).
				*/
				while(index >= examinedNodes[0].textContent.length) {
					index -= examinedNodes[0].textContent.length;
					examinedNodes.shift();
				}
				/*
					In the event that it was found within a single node,
					simply slice that node only.
				*/
				if (examinedNodes.length === 1) {
					slices = sliceNode(examinedNodes[0], index, index + searchString.length);
					ret.push(slices[0]);
					// The extra slice at the end shall be examined
					// in the next recursion.
					if (slices[1]) {
						textNodes.unshift(slices[1]);
					}
					break;
				}
				/*
					We now push multiple components: a slice from the first examined node
					(which will extract the entire right side of the node):
				*/
				ret.push(sliceNode(
					examinedNodes[0],
					index,
					examinedNodes[0].length
				)
				/*
					(Since we're extracting the right side, there will be no 'end' slice
					returned by sliceNode. So, just use the first returned element.)
				*/
				[0]);
				/*
					Then, all of the nodes between first and last:
				*/
				ret.push.apply(ret, examinedNodes.slice(1,-1));
				/*
					Then, a slice from the last examined node (which will extract
					the entire left side).
				*/
				slices = sliceNode(
					examinedNodes[examinedNodes.length-1],
					0,
					examinedNodes[examinedNodes.length-1].textContent.length - remainingLength
				);
				ret.push(slices[0]);
				// The extra slice at the end shall be examined
				// in the next recursion.
				if (slices[1]) {
					textNodes.unshift(slices[1]);
				}
				// Finally, if any of the above were undefined, we remove them.
				ret = ret.filter(Boolean);
				break;
			}
		}
		/*
			The above only finds the first substring match. The further ones
			are obtained through this recursive call.
		*/
		return [ret].concat(findTextInNodes(textNodes, searchString));
	}
	
	/*
		Public methods here on are laid.
	*/
	var HookUtils = {
		
		/**
			@method wrapTextNodes
			@static
			@param {String} searchString The passage text to wrap
			@param {jQuery} dom The DOM in which to search
			@param {String} htmlTag The HTML tag to wrap around
			@return {jQuery} A jQuery set holding the created HTML wrapper tags.
		*/
		wrapTextNodes: function(searchString, dom, htmlTag) {
			var nodes = findTextInNodes(dom.textNodes(), searchString),
				ret = $();
			nodes.forEach(function(e) {
				ret = ret.add($(e).wrapAll(htmlTag));
			});
			return ret;
		},
		
		/**
			Returns the type of a selector string.
			Currently used simply to differentiate hookRef strings.
			TODO: Use TwineMarkup.RegExpStrings.

			@method selectorType
			@static
			@param val Value to examine
			@return {String} Description
		*/
		selectorType: function (val) {
			var r;
			
			if (val && typeof val === "string") {
				r = /\?(\w*)/.exec(val);

				if (r && r.length) {
					return "hookRef";
				}
				// Assume it's a plain word selector
				return "string";
			}
			return "undefined";
		},

		/**
			Convert a hook index string to a CSS selector.

			@method hookToSelector
			@param {String} list	chain to convert
			@return {String} classlist string
		*/
		hookToSelector: function (c) {
			c = c.replace(/"/g, "&quot;");
			return Selectors.hook+'[name="' + c + '"]';
		}
	};
	return Object.freeze(HookUtils);
});
