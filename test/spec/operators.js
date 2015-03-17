describe("twinescript operators", function () {
	'use strict';
	describe("the + operator", function () {
		it("adds numbers", function (){
			expectMarkupToPrint("(print: 3 + 5)","8");
		});
		it("can be used to concatenate strings", function () {
			expectMarkupToPrint("(print: '15' + '2')", "152");
		});
		it("can be used to concatenate arrays", function () {
			expectMarkupToPrint("(print: (a:1) + (a:2))", "1,2");
			expectMarkupToPrint("(print: (a:1,3) + (a:2,4))", "1,3,2,4");
		});
	});
	describe("the - operator", function () {
		it("subtracts numbers", function (){
			expectMarkupToPrint("(print: 3 - 5)","-2");
		});
		it("can be used on strings", function () {
			expectMarkupToPrint("(print: '51' - '5')", "1");
			expectMarkupToPrint("(print: 'reeeed' - 'e')", "rd");
		});
		it("can be used on arrays", function () {
			expectMarkupToPrint("(print: (a:1,3,5,3) - (a:3))", "1,5");
		});
	});
	describe("the * operator", function () {
		it("multiplies numbers", function (){
			expectMarkupToPrint("(print: 3 * 5)","15");
		});
		it("can't be used on strings", function () {
			expectMarkupToError("(print: '15' * '2')");
		});
	});
	describe("the / operator", function () {
		it("divides numbers", function (){
			expectMarkupToPrint("(print: 15 / 5)","3");
		});
		it("can't be used on strings", function () {
			expectMarkupToError("(print: '15' / '2')");
		});
		it("can't divide by zero", function () {
			expectMarkupToError("(print: 15 / 0)");
		});
	});
	describe("the % operator", function () {
		it("remainders numbers", function (){
			expectMarkupToPrint("(print: 31 % 10)","1");
		});
		it("can't be used on strings", function () {
			expectMarkupToError("(print: '15' * '2')");
		});
		it("can't divide by zero", function (){
			expectMarkupToError("(print: 15 % 0)");
		});
	});
	describe("the 'is' operator", function () {
		it("compares primitives by value", function (){
			expectMarkupToPrint("(print: 2 is 2)","true");
			expectMarkupToPrint("(print: '2' is '2')","true");
			expectMarkupToPrint("(print: true is true)","true");
			expectMarkupToPrint("(print: 2 is 1)","false");
			expectMarkupToPrint("(print: '3' is '2')","false");
			expectMarkupToPrint("(print: true is false)","false");
		});
		it("doesn't coerce values", function (){
			expectMarkupToPrint("(print: 2 is '2')","false");
			expectMarkupToPrint("(print: 1 is true)","false");
		});
		it("can be used as an expression", function (){
			expectMarkupToPrint("(print: 2 is '2' is true)","false");
			expectMarkupToPrint("(print: 1 is true is false)","false");
		});
		it("compares arrays by value", function (){
			expectMarkupToPrint("(print: (a:) is (a:))","true");
			expectMarkupToPrint("(print: (a:2,3,4) is (a:2,3,4))","true");
			expectMarkupToPrint("(print: (a:2,3,4) is (a:2,3,5))","false");
			expectMarkupToPrint("(print: (a:(a:)) is (a:(a:)))","true");
		});
		it("compares datamaps by value", function (){
			expectMarkupToPrint("(print: (datamap:) is (datamap:))","true");
			expectMarkupToPrint("(print: (datamap:'a',2,'b',4) is (datamap:'b',4,'a',2))","true");
			expectMarkupToPrint("(print: (datamap:) is (datamap:1))","false");
			expectMarkupToPrint("(print: (datamap:'a',2,'b',4) is (datamap:'b',4,'a',3))","false");
		});
		it("compares datasets by value", function (){
			expectMarkupToPrint("(print: (dataset:) is (dataset:))","true");
			expectMarkupToPrint("(print: (dataset:2,3,4) is (dataset:2,3,4))","true");
			expectMarkupToPrint("(print: (dataset:2,3,4) is (dataset:2,3,4,5))","false");
		});
		it("won't be matched from within text", function (){
			expectMarkupToPrint("(print: typeof xxisxx)","undefined");
		});
	});
	describe("the 'is not' operator", function () {
		it("compares primitives by value", function (){
			expectMarkupToPrint("(print: 2 is not 2)","false");
			expectMarkupToPrint("(print: '2' is not '2')","false");
			expectMarkupToPrint("(print: true is not true)","false");
			expectMarkupToPrint("(print: 2 is not 1)","true");
			expectMarkupToPrint("(print: '3' is not '2')","true");
			expectMarkupToPrint("(print: true is not false)","true");
		});
		it("doesn't coerce values", function (){
			expectMarkupToPrint("(print: 2 is not '2')","true");
			expectMarkupToPrint("(print: 1 is not true)","true");
		});
		it("can be used as an expression", function (){
			expectMarkupToPrint("(print: 2 is not '2' is not true)","true");
			expectMarkupToPrint("(print: true is not true is not false)","false");
		});
		it("compares arrays by value", function (){
			expectMarkupToPrint("(print: (a:) is not (a:))","false");
			expectMarkupToPrint("(print: (a:2,3,4) is not (a:2,3,4))","false");
			expectMarkupToPrint("(print: (a:2,3,4) is not (a:2,3,5))","true");
			expectMarkupToPrint("(print: (a:(a:)) is not (a:(a:)))","false");
		});
		it("compares datamaps by value", function (){
			expectMarkupToPrint("(print: (datamap:) is not (datamap:))","false");
			expectMarkupToPrint("(print: (datamap:'a',2,'b',4) is not (datamap:'b',4,'a',2))","false");
			expectMarkupToPrint("(print: (datamap:) is not (datamap:1))","true");
			expectMarkupToPrint("(print: (datamap:'a',2,'b',4) is not (datamap:'b',4,'a',3))","true");
		});
		it("compares datasets by value", function (){
			expectMarkupToPrint("(print: (dataset:) is not (dataset:))","false");
			expectMarkupToPrint("(print: (dataset:2,3,4) is not (dataset:2,3,4))","false");
			expectMarkupToPrint("(print: (dataset:2,3,4) is not (dataset:2,3,4,5))","true");
		});
		it("won't be matched from within text", function (){
			expectMarkupToPrint("(print: typeof xxisxx)","undefined");
		});
	});
	describe("the 'contains' operator", function () {
		it("checks for substrings in strings", function (){
			expectMarkupToPrint("(print: 'Bee' contains 'Be')","true");
			expectMarkupToPrint("(print: 'Bee' contains 'Bee')","true");
			expectMarkupToPrint("(print: 'Bee' contains 'eeB')","false");
		});
		it("checks for elements in arrays", function (){
			expectMarkupToPrint("(print: (a:'Bee') contains 'Bee')","true");
			expectMarkupToPrint("(print: (a: 2) contains 2)","true");
			expectMarkupToPrint("(print: (a:'Bee') contains 'eeB')","false");
		});
		it("checks for keys in datamaps", function (){
			expectMarkupToPrint("(print: (datamap:'Bee',1) contains 'Bee')","true");
			expectMarkupToPrint("(print: (datamap:'Bee',1) contains 1)","false");
		});
		it("checks for elements in datasets", function (){
			expectMarkupToPrint("(print: (dataset:'Bee','Boo') contains 'Bee')","true");
			expectMarkupToPrint("(print: (dataset:'Bee','Boo') contains 'ooB')","false");
		});
		it("reverts to 'is' comparison for non-string primitives", function (){
			expectMarkupToPrint("(print: 2 contains 2)","true");
			expectMarkupToPrint("(print: true contains true)","true");
		});
		it("can be used as an expression", function (){
			expectMarkupToPrint("(print: 'Bee' contains 'Be' is true)","true");
			expectMarkupToPrint("(print: 'Bee' contains 'eeB' is false)","true");
		});
		it("compares arrays by value", function (){
			expectMarkupToPrint("(print: (a:(a:)) contains (a:))","true");
			expectMarkupToPrint("(print: (a:(a:2,3,4)) contains (a:2,3,4))","true");
		});
		it("compares datamaps by value", function (){
			expectMarkupToPrint("(print: (a:(datamap:)) contains (datamap:))","true");
			expectMarkupToPrint("(print: (a:(datamap:'a',2,'b',4)) contains (datamap:'b',4,'a',2))","true");
		});
		it("compares datasets by value", function (){
			expectMarkupToPrint("(print: (a:(dataset:)) contains (dataset:))","true");
			expectMarkupToPrint("(print: (a:(dataset:2,3,4)) contains (dataset:2,3,4))","true");
		});
		it("won't be matched from within text", function (){
			expectMarkupToPrint("(print: typeof xxcontainsxx)","undefined");
		});
	});
	describe("the 'is in' operator", function () {
		it("checks for substrings in strings", function (){
			expectMarkupToPrint("(print: 'Be' is in 'Bee')","true");
			expectMarkupToPrint("(print: 'Bee' is in 'Bee')","true");
			expectMarkupToPrint("(print: 'Bee' is in 'eeB')","false");
		});
		it("checks for elements in arrays", function (){
			expectMarkupToPrint("(print: 'Bee' is in (a:'Bee'))","true");
			expectMarkupToPrint("(print: 2 is in (a: 2))","true");
			expectMarkupToPrint("(print: 'eeB' is in (a:'Bee'))","false");
		});
		it("checks for keys in datamaps", function (){
			expectMarkupToPrint("(print: (datamap:'Bee',1) contains 'Bee')","true");
			expectMarkupToPrint("(print: (datamap:'Bee',1) contains 1)","false");
		});
		it("checks for elements in datasets", function (){
			expectMarkupToPrint("(print: 'Bee' is in (dataset:'Bee','Boo'))","true");
			expectMarkupToPrint("(print: 'ooB' is in (dataset:'Bee','Boo'))","false");
		});
		it("reverts to 'is' comparison for non-string primitives", function (){
			expectMarkupToPrint("(print: 2 is in 2)","true");
			expectMarkupToPrint("(print: true is in true)","true");
		});
		it("can be used as an expression", function (){
			expectMarkupToPrint("(print: true is 'Be' is in 'Bee')","true");
			expectMarkupToPrint("(print: false is 'Bee' is in 'eeB')","true");
		});
		it("compares arrays by value", function (){
			expectMarkupToPrint("(print: (a:) is in (a:(a:)))","true");
			expectMarkupToPrint("(print: (a:2,3,4) is in (a:(a:2,3,4)))","true");
		});
		it("compares datamaps by value", function (){
			expectMarkupToPrint("(print: (datamap:) is in (a:(datamap:)))","true");
			expectMarkupToPrint("(print: (datamap:'b',4,'a',2) is in (a:(datamap:'a',2,'b',4)))","true");
		});
		it("compares datasets by value", function (){
			expectMarkupToPrint("(print: (dataset:) is in (a:(dataset:)))","true");
			expectMarkupToPrint("(print: (dataset:2,3,4) is in (a:(dataset:2,3,4)))","true");
		});
		it("won't be matched from within text", function (){
			expectMarkupToPrint("(print: typeof xxis in Object)","false");
		});
	});
});
