describe("style changer macros", function() {
	'use strict';
	describe("the (css:) macro", function() {
		it("requires exactly 1 string argument", function() {
			expectMarkupToError("(css:)");
			expectMarkupToError("(css:1)");
			expectMarkupToError("(css:'A','B')");
		});
		it("applies the passed CSS to the hook as an inline style property", function() {
			expect(runPassage("(css:'display:inline-block')[Hey]").find('tw-hook').css('display'))
				.toBe('inline-block');
			expect(runPassage("(css:'clear:both;')[Hey]").find('tw-hook').css('clear'))
				.toBe('both');
		});
		it("can be (set:) in a variable", function() {
			runPassage("(set: $s to (css:'display:inline-block;'))");
			var hook = runPassage("$s[Hey]").find('tw-hook');
			expect(hook.css('display')).toBe('inline-block');
		});
		it("can compose with itself", function() {
			runPassage("(set: $s to (css:'display:inline-block') + (css:'clear:both'))");
			var hook = runPassage("$s[Hey]").find('tw-hook');
			expect(hook.css('display')).toBe('inline-block');
			expect(hook.css('clear')).toBe('both');
		});
	});
	
	describe("the (align:) macro", function() {
		it("requires exactly 1 string argument", function() {
			expectMarkupToError("(align:)");
			expectMarkupToError("(align:1)");
			expectMarkupToError("(align:'A','B')");
		});
		it("errors if not given an valid arrow", function() {
			expectMarkupToError("(align:'')");
			expectMarkupToError("(align:'===')");
			expectMarkupToError("(align:'<<==')");
			expectMarkupToError("(align:'===><==>')");
		});
		it("right-aligns text when given '==>'", function() {
			var align = runPassage("(align:'==>')[garply]").find('tw-hook');
			expect(align.css('text-align')).toBe('right');
			expect(align.text()).toBe('garply');
			expect(align.css('margin-left')).toMatch(/^(?:0px)?$/);
		});
		it("ignores the number of, and imbalance of, = signs used", function() {
			[2,3,4,5,6,7,8,9,10].forEach(function(number) {
				var align = runPassage("(align:'" + "=".repeat(number) + ">')[garply]").find('tw-hook');
				expect(align.css('text-align')).toBe('right');
				expect(align.text()).toBe('garply');
				expect(align.css('margin-left')).toMatch(/^(?:0px)?$/);
			});
		});
		it("centres text with a balanced '=><='", function() {
			var align = runPassage("(align:'=><=')[garply]").find('tw-hook');
			expect(align.css('text-align')).toBe('center');
			expect(align.text()).toBe('garply');
			expect(align.attr('style')).toMatch(/max-width:\s*50%/);
			expect(align.attr('style')).toMatch(/margin-left:\s*auto/);
			expect(align.attr('style')).toMatch(/margin-right:\s*auto/);
		});
		it("justifies text with '<==>'", function() {
			var align = runPassage("(align:'<==>')[garply]").find('tw-hook');
			expect(align.css('text-align')).toBe('justify');
			expect(align.text()).toBe('garply');
			expect(align.css('margin-left')).toMatch(/^(?:0px)?$/);
		});
		it("aligns text with unbalanced '==><='", function() {
			var align = runPassage("(align:'==><====')[garply]").find('tw-hook');
			expect(align.css('text-align')).toBe('center');
			expect(align.attr('style')).toMatch(/margin-left:\s*17%/);
			
			align = runPassage("(align:'=====><=')[garply]").find('tw-hook');
			expect(align.css('text-align')).toBe('center');
			expect(align.attr('style')).toMatch(/margin-left:\s*42%/);
		});
	});
});
