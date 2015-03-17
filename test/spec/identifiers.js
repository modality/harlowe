describe("identifiers", function () {
	'use strict';
	describe("the 'it' identifier", function () {
		it("refers to the left side of a recent comparison", function (){
			expectMarkupToPrint("(set:$red to 3)(print: $red > 2 and it < 4)","true");
			expectMarkupToPrint("(set:$red to 'egg')(print: $red contains 'g' and it contains 'e')","true");
			expectMarkupToPrint("(set:$red to 'egg')(set:$blue to 'g')(print: $blue is in $red and it is in 'go')","true");
		});
		it("is case-insensitive", function (){
			expectMarkupToPrint("(set:$red to 'Bee')(set:$red to IT + 's')(set:$red to iT + '!')$red","Bees!");
		});
		it("also refers to the left side of a 'to' operation", function (){
			expectMarkupToPrint("(set:$red to 'Bee')(set:$red to it + 's')$red","Bees");
		});
		it("can't be used in an 'into' operation", function (){
			expectMarkupToError("(put:'Bee' into $red)(put:$red + 's' into it)");
		});
		it("can't be used as the subject of a 'to' operation", function (){
			expectMarkupToError("(set:$red to 1)(set:it to it + 2)");
		});
	});
	describe("implicit 'it'", function () {
		it("is added for incomplete comparisons", function (){
			expectMarkupToPrint("(set:$red to 3)(print: $red > 2 and < 4)","true");
			expectMarkupToPrint("(set:$red to 'egg')(print: $red contains 'g' and contains 'e')","true");
			expectMarkupToPrint("(set:$red to 'egg')(set:$blue to 'g')(print: $blue is in $red and is in 'go')","true");
		});
	});
	describe("the 'its' property access syntax", function () {
		it("accesses properties from the left side of a recent comparison", function (){
			expectMarkupToPrint("(set:$red to 'egg')(print: $red is 'egg' and its length is 3)","true");
		});
		it("also accesses properties from the left side of a 'to' operation", function (){
			expectMarkupToPrint("(set:$red to 'Bee')(set:$red to its 1st)$red","B");
		});
		it("can have properties accessed from it", function (){
			expectMarkupToPrint("(set:$red to (a:'Bee'))(set:$red to its 1st's 1st)$red","B");
		});
	});
	describe("the computed 'its' property access syntax", function () {
		it("accesses properties from the left side of a recent comparison", function (){
			expectMarkupToPrint("(set:$red to 'egg')(print: $red is 'egg' and its ('length') is 3)","true");
		});
		it("also accesses properties from the left side of a 'to' operation", function (){
			expectMarkupToPrint("(set:$red to 'Bee')(set:$red to its (1))$red","B");
		});
		it("can have properties accessed from it", function (){
			expectMarkupToPrint("(set:$red to (a:'Bee'))(set:$red to its (1)'s 1st)$red","B");
			expectMarkupToPrint("(set:$red to (a:'Bee'))(set:$red to its (1)'s (1))$red","B");
		});
	});
});
