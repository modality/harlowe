define(['utils', 'jquery'], function(Utils, $){
	/*
		Colours are first-class objects in TwineScript.
		You can't do much with them, though - just add them.
	*/
	"use strict";
	var Colour,
		/*
			These RegExps check for HTML #fff and #ffffff format colours.
		*/
		singleDigit   = /^([\da-fA-F])$/,
		tripleDigit   = /^([\da-fA-F])([\da-fA-F])([\da-fA-F])$/,
		sextupleDigit = /^([\da-fA-F])([\da-fA-F])([\da-fA-F])([\da-fA-F])([\da-fA-F])([\da-fA-F])$/,
		/*
			This cache here is used by the function just below.
		*/
		cssNameCache = Object.create(null);

	/*
		This private function tries its best to convert a CSS3 colour name (like "rebeccapurple"
		or "papayawhip") to an RGB object. It uses jQuery to make the initial lookup, and
		caches the resulting object for future lookups.
	*/
	function css3ToRGB(colourName) {
		if (colourName in cssNameCache) {
			return cssNameCache[colourName];
		}
		var colour = $("<p>").css("background-color", colourName).css("background-color");
		if (!colour.startsWith('rgb')) {
			colour = { r:192, g:192, b:192 };
		}
		else {
			colour = colour.match(/\d+/g).reduce(function(colour, num, ind) {
				colour["rgb"[ind]] = +num;
				return colour;
			}, {});
		}
		cssNameCache[colourName] = colour;
		return colour;
	}
	
	/*
		This private function converts a string comprising a CSS hex colour
		into an {r,g,b} object.
		This, of course, doesn't attempt to trim the string, or
		perform "flex hex" parsing to over-long strings.
		(http://scrappy-do.blogspot.com/2004/08/little-rant-about-microsoft-internet.html)
	*/
	function hexToRGB(str) {
		// Assume that any non-strings passed in here are already valid {r,g,b}s.
		if (typeof str !== "string") {
			return str;
		}
		// Trim off the "#".
		str = str.replace("#", '');
		/*
			If a 3-char hex colour was passed, convert it to a 6-char colour.
		*/
		str = str.replace(tripleDigit, "$1$1$2$2$3$3");
		
		return {
			r: parseInt(str.slice(0,2), 16),
			g: parseInt(str.slice(2,4), 16),
			b: parseInt(str.slice(4,6), 16),
		};
	}

	Colour = Object.freeze({
		colour: true,
		TwineScript_TypeName:   "a colour",
		TwineScript_ObjectName: "a colour",
		
		/*
			Colours can be blended by addition.
		*/
		"TwineScript_+": function(other) {
			/*
				These are just shorthands (for "lvalue" and "rvalue").
			*/
			var l = this,
				r = other;
			
			return Colour.create({
				/*
					You may notice this is a fairly glib blending
					algorithm. It's the same one from Game Maker,
					though, so I'm hard-pressed to think of a more
					intuitive one.
				*/
				r : Math.min(Math.round((l.r + r.r) * 0.6), 0xFF),
				g : Math.min(Math.round((l.g + r.g) * 0.6), 0xFF),
				b : Math.min(Math.round((l.b + r.b) * 0.6), 0xFF),
			});
		},
		
		TwineScript_Print: function() {
			return "<tw-colour style='background-color:rgb("
				+ [this.r, this.g, this.b].join(',') + ");'></span>";
		},
		
		TwineScript_is: function(other) {
			return Colour.isPrototypeOf(other) &&
				other.r === this.r &&
				other.g === this.g &&
				other.b === this.b;
		},
		
		TwineScript_Clone: function() {
			return Colour.create(this);
		},
		
		/*
			This converts the colour into a 6-char HTML hex string.
			(No, this doesn't create a 3-char colour if one was possible. Sorry.)
		*/
		toHexString: function() {
			Utils.assert(this !== Colour);
			return "#"
				/*
					Number.toString() won't have a leading 0 unless
					we manually insert it.
				*/
				+ (this.r).toString(16).replace(singleDigit, "0$1")
				+ (this.g).toString(16).replace(singleDigit, "0$1")
				+ (this.b).toString(16).replace(singleDigit, "0$1");
		},
		/*
			This constructor accepts an object containing r, g and b numeric properties,
			or a string comprising a CSS hex colour.
		*/
		create: function(rgbObj) {
			if (typeof rgbObj === "string") {
				if (Colour.isHexString(rgbObj)) {
					return this.create(hexToRGB(rgbObj));
				}
				return this.create(css3ToRGB(rgbObj));
			}
			return Object.assign(Object.create(this), rgbObj);
		},
		/*
			This static method determines if a given string matches a HTML hex colour format.
		*/
		isHexString: function(str) {
			return (typeof str === "string" && str[0] === "#"
				&& (str.slice(1).match(tripleDigit) || str.slice(1).match(sextupleDigit)));
		},
	});
	return Colour;
});
