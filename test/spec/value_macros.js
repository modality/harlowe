describe("basic value macros", function() {
	'use strict';
	describe("the (text:) macro", function() {
		it("accepts 0 or more arguments of any primitive type", function() {
			["1", "'X'", "true"].forEach(function(e) {
				for(var i = 0; i < 10; i += 1) {
					expect(runPassage("(text:" + (e + ",").repeat(i) + ")").find('tw-expression').length).toBe(1);
				}
			});
		});
		it("converts number arguments to a string", function() {
			expectMarkupToPrint("(text: 2)", "2");
		});
		it("converts boolean arguments to a string", function() {
			expectMarkupToPrint("(text: 3 is 4)", "false");
		});
		it("joins string arguments", function() {
			expectMarkupToPrint("(text: 'gar', 'ply')","garply");
		});
		it("refuses object arguments", function() {
			expectMarkupToError("(text: (text-style:'shadow'))");
			expectMarkupToError("(text: (datamap:))");
		});
		it("is aliased as (string:)", function() {
			expectMarkupToPrint("(string: 2)", "2");
		});
	});
	describe("the (number:) macro", function() {
		it("accepts exactly 1 string argument", function() {
			expectMarkupToError("(number:)");
			expectMarkupToPrint("(number:'1')", '1');
			expectMarkupToError("(number:'1','1')");
		});
		it("converts string arguments to a number", function() {
			expectMarkupToPrint("(number: '2.' + '5')", "2.5");
		});
		it("shows an error if it does not succeed", function() {
			expectMarkupToError("(number: 'Dogs')");
		});
		it("is aliased as (num:)", function() {
			expectMarkupToPrint("(num: '2')", "2");
		});
	});
	describe("the (substring:) macro", function() {
		it("accepts 1 string argument, then two number arguments", function() {
			expectMarkupToError("(substring:)");
			expectMarkupToError("(substring: '1')");
			expectMarkupToPrint("(substring: 'red', 1, 2)", 're');
		});
		it("returns the substring specified by the two 1-indexed start and end indices", function() {
			expectMarkupToPrint("(substring: 'garply', 2, 4)", "arp");
		});
		it("reverses the indices if the second exceeds the first", function() {
			expectMarkupToPrint("(substring: 'garply', 4, 2)", "arp");
		});
		it("accepts negative indices", function() {
			expectMarkupToPrint("(substring: 'garply', 2, -1)", "arply");
			expectMarkupToPrint("(substring: 'garply', -2, 1)", "garpl");
			expectMarkupToPrint("(substring: 'garply', -1, -3)", "ply");
		});
		it("refuses zero and NaN indices", function() {
			expectMarkupToError("(substring: 'garply', 0, 2)");
			expectMarkupToError("(substring: 'garply', 2, NaN)");
		});
	});
	describe("the (subarray:) macro", function() {
		it("accepts 1 array argument, then two number arguments", function() {
			expectMarkupToError("(subarray:)");
			expectMarkupToError("(subarray: (a:'1'))");
			expectMarkupToPrint("(subarray: (a:6,7), 1, 2)", '6,7');
		});
		it("returns the subarray specified by the two 1-indexed start and end indices", function() {
			expectMarkupToPrint("(subarray: (a:8,7,6,5,4), 2, 4)", "7,6,5");
		});
		it("reverses the indices if the second exceeds the first", function() {
			expectMarkupToPrint("(subarray: (a:8,7,6,5,4), 4, 2)", "7,6,5");
		});
		it("accepts negative indices", function() {
			expectMarkupToPrint("(subarray: (a:8,7,6,5,4), 2, -1)", "7,6,5,4");
			expectMarkupToPrint("(subarray: (a:8,7,6,5,4), -2, 1)", "8,7,6,5");
			expectMarkupToPrint("(subarray: (a:8,7,6,5,4), -1, -3)", "6,5,4");
		});
		it("refuses zero and NaN indices", function() {
			expectMarkupToError("(subarray: (a:8,7,6,5,4), 0, 2)");
			expectMarkupToError("(subarray: (a:8,7,6,5,4), 2, NaN)");
		});
	});
	describe("the (if:) macro", function() {
		it("accepts exactly 1 boolean argument", function() {
			expectMarkupToError("(if:)");
			expectMarkupToNotError("(if:true)");
			expectMarkupToError("(if:'1')");
		});
		it("returns its passed argument", function() {
			expectMarkupToPrint("(print:(if:false))", 'false');
			expectMarkupToPrint("(print:(if:true))", 'true');
		});
	});
	describe("the (unless:) macro", function() {
		it("accepts exactly 1 boolean argument", function() {
			expectMarkupToError("(unless:)");
			expectMarkupToNotError("(unless:true)");
			expectMarkupToError("(unless:'1')");
		});
		it("inverts its passed argument", function() {
			expectMarkupToPrint("(print:(unless:false))", 'true');
			expectMarkupToPrint("(print:(unless:true))", 'false');
		});
	});
	describe("the (else-if:) macro", function() {
		it("accepts exactly 1 boolean argument", function() {
			expectMarkupToError("(else-if:)");
			expectMarkupToError("(else-if:'1')");
		});
		it("must occur after a conditionally displayed hook", function() {
			expectMarkupToError("(else-if:false)");
			expectMarkupToNotError("(either:true)[](print:(else-if:true))");
			expectMarkupToNotError("(either:false)[](print:(else-if:true))");
		});
		it("is false if the preceding hook was displayed, else returns it argument", function() {
			expectMarkupToPrint("(either:false)[](print:(else-if:true))", 'true');
			expectMarkupToPrint("(either:false)[](print:(else-if:false))", 'false');
			expectMarkupToPrint("(either:true)[](print:(else-if:true))", 'false');
		});
		it("works even when nested", function() {
			expectMarkupToPrint("(either:true)[(either:false)[](print:(else-if:true))](print:(else-if:true))", 'truefalse');
			expectMarkupToPrint("(either:true)[(either:true)[](print:(else-if:true))](print:(else-if:true))", 'falsefalse');
		});
	});
	describe("the (else:) macro", function() {
		it("accepts exactly 0 arguments", function() {
			expectMarkupToError("(else:true)");
			expectMarkupToError("(else:'1')");
		});
		it("must occur after a conditionally displayed hook", function() {
			expectMarkupToError("(else:)");
			expectMarkupToNotError("(either:true)[](print:(else:))");
			expectMarkupToNotError("(either:false)[](print:(else:))");
		});
		it("is false if the preceding hook was displayed, else returns true", function() {
			expectMarkupToPrint("(either:false)[](print:(else-if:true))", 'true');
			expectMarkupToPrint("(either:false)[](print:(else-if:false))", 'false');
			expectMarkupToPrint("(either:true)[](print:(else-if:true))", 'false');
		});
		it("works even when nested", function() {
			expectMarkupToPrint("(either:true)[(either:false)[](print:(else:))](print:(else:))", 'truefalse');
			expectMarkupToPrint("(either:true)[(either:true)[](print:(else:))](print:(else:))", 'falsefalse');
		});
	});
});
