define([], function() {
	"use strict";
	/*
		Static namespace containing CSS/jQuery selectors for Harlowe DOM elements
	*/
	return Object.freeze({
		passage: "tw-passage",
		story: "tw-story",
		sidebar: "tw-sidebar",
		internalLink: "tw-link",
		brokenLink: "tw-broken-link",
		hook: "tw-hook",
		pseudoHook: "tw-pseudo-hook",
		expression: "tw-expression",
		enchanter: "[enchanter]",
		script: "[role=script]",
		stylesheet: "[role=stylesheet]",
		storyData: "tw-storydata",
		passageData: "tw-passagedata",
		whitespace: "tw-char[char=space], tw-char[char=tab], br",
		collapsed: "tw-collapsed",
	});
});
