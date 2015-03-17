describe("setup passages", function() {
	'use strict';
	describe("the 'passage-setup' tag", function() {
		it("makes the passage's prose run before any other passage is run", function() {
			createPassage("(set: $red to $red + 1)","setup",["passage-setup"]);
			expectMarkupToPrint("$red","1");
			expectMarkupToPrint("$red","2");
			expectMarkupToPrint("$red","3");
		});
		it("tagged passages can be removed", function() {
			createPassage("(set: $red to $red + 1)","setup",["passage-setup"]);
			expectMarkupToPrint("$red","1");
			expectMarkupToPrint("$red(set:$Passages's setup's tags to (a:))","2");
			expectMarkupToPrint("$red","2");
		});
		it("tagged passages run in alphabetical order", function() {
			createPassage("(set: $red to 'A')","setup1",["passage-setup"]);
			createPassage("(set: $red to $red + 'B')","setup2",["passage-setup"]);
			expectMarkupToPrint("$red","AB");
		});
		it("affects hooks inside the passage", function() {
			createPassage("(click: ?red)[]","setup",["passage-setup"]);
			expect(runPassage("|red>[Hmm]","1").find('tw-enchantment').length).toBe(1);
		});
	});
	describe("the 'story-setup' tag", function() {
		it("makes the passage's prose run before the very first passage is run", function() {
			createPassage("(set: $red to $red + 1)","setup",["story-setup"]);
			expectMarkupToPrint("$red","1");
			expectMarkupToPrint("$red","1");
		});
		it("tagged passages run in alphabetical order", function() {
			createPassage("(set: $red to 'A')","setup1",["story-setup"]);
			createPassage("(set: $red to $red + 'B')","setup2",["story-setup"]);
			expectMarkupToPrint("$red","AB");
		});
		it("tagged passages run before passage-setup passages", function() {
			createPassage("(set: $red to 'A')","setup2",["story-setup"]);
			createPassage("(set: $red to $red + 'B')","setup1",["passage-setup"]);
			expectMarkupToPrint("$red","AB");
		});
		it("affects hooks inside the passage", function() {
			createPassage("(click: ?red)[]","setup",["story-setup"]);
			expect(runPassage("|red>[Hmm]","1").find('tw-enchantment').length).toBe(1);
		});
	});
});
