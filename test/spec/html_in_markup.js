describe("HTML in twinemarkup", function() {
	'use strict';

	describe("span-level tags", function() {
		it("turn into their respective elements", function() {
			expectMarkupToBecome(
				"<i>What</i> <b>is</b> <u>this</u>?",
				"<i>What</i> <b>is</b> <u>this</u>?"
			);
		});
		it("persist across line breaks", function() {
			expectMarkupToBecome(
				"<i>What\n</i> <b>is\n</b> <u>this\n</u>?",
				"<i>What<br></i> <b>is<br></b> <u>this<br></u>?"
			);
		});
	});
	describe("block-level tags", function() {
		it("turn into their respective elements", function() {
			expectMarkupToBecome(
				"<div>Hey</div>?",
				"<div>Hey</div>?"
			);
		});
	});
	describe("elements with attributes", function() {
		it("retain their attributes", function() {
			var DOM = runPassage("<div id='gerald' style='background-color:black'>Hey</div>?");
			
			expect(DOM.find("#gerald").attr('style')).toMatch(/background-color:\s*black/);
		});
	});
	describe("<script> tags", function() {
		it("execute their contained code", function() {
			expect(runPassage("Hey!<script>window.foo = 1;</script>").find('script').length).toBe(1);
			expect(window.foo).toBe(1);
		});
		afterEach(function() {
			delete window.foo;
		});
	});
	describe("<style> tags", function() {
		it("can be used without escaping their contents", function() {
			expect(runPassage("<style>b { box-sizing: content-box; }</style><b>Hey</b>").find('b').css('box-sizing')).toBe('content-box');
		});
	});
});
