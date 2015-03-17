describe("links", function() {
	'use strict';

	describe("(link-goto:)", function() {
		it("renders to a <tw-link> element if the linked passage exists", function() {
			createPassage("","mire");
			var link = runPassage("(link-goto:'mire')").find('tw-link');
		
			expect(link.parent().is('tw-expression')).toBe(true);
			expect(link.tag()).toBe("tw-link");
			expect(link.attr("passage-name")).toBe("mire");
		});
		it("becomes a <tw-broken-link> if the linked passage is absent", function() {
			var link = runPassage("(link-goto: 'mire')").find('tw-broken-link');
		
			expect(link.parent().is('tw-expression')).toBe(true);
			expect(link.tag()).toBe("tw-broken-link");
			expect(link.html()).toBe("mire");
		});
		it("produces an error if given no arguments", function() {
			var error = runPassage("(link-goto:)").find('tw-error');
		
			expect(error.length).toBe(1);
		});
		it("produces an error if given non-string arguments", function() {
			var error = runPassage("(link-goto: 2)(link-goto: true)").find('tw-error');
		
			expect(error.length).toBe(2);
		});
		it("goes to the passage when clicked", function() {
			createPassage("<p>garply</p>","mire");
			var link = runPassage("(link-goto:'mire')").find('tw-link');
			link.click();
			expect($('tw-passage p').text()).toBe("garply");
		});
		it("can be focused", function() {
			createPassage("","mire");
			var link = runPassage("(link-goto:'mire')").find('tw-link');
			expect(link.attr("tabindex")).toBe("0");
		});
		it("behaves as if clicked when the enter key is pressed while it is focused", function() {
			createPassage("<p>garply</p>","mire");
			var link = runPassage("(link-goto:'mire')").find('tw-link');
			link.trigger($.Event('keydown', { which: 13 }));
			expect($('tw-passage p').text()).toBe("garply");
		});
	});

	describe("link syntax", function() {
		describe("simple link syntax", function() {
			it("consists of [[, text, then ]], and desugars to a (link-goto:) macro", function() {
				var expression = runPassage("[[flea]]").find('tw-expression');
			
				expect(expression.tag()).toBe("tw-expression");
				expect(expression.attr("type")).toBe("macro");
				expect(expression.attr("name")).toBe("link-goto");
				expect(expression.text()).toBe("flea");
			});
			it("may have non-sequential ]s in the text", function() {
				var expression = runPassage("[[fl]e]a]]").find('tw-expression');
			
				expect(expression.tag()).toBe("tw-expression");
				expect(expression.attr("type")).toBe("macro");
				expect(expression.attr("name")).toBe("link-goto");
				expect(expression.text()).toBe("fl]e]a");
			});
			it("may contain markup, and links to the correct passage based on the plain text", function() {
				createPassage("","mire");
				var link = runPassage("[[mi''r''e]]").find('tw-link');
			
				expect(link.tag()).toBe("tw-link");
				expect(link.html()).toBe("mi<b>r</b>e");
				expect(link.attr("passage-name")).toBe("mire");
			});
			it("may contain line breaks", function() {
				createPassage("","mire");
				var link = runPassage("[[\nmire\n]]").find('tw-link');
			
				expect(link.tag()).toBe("tw-link");
				expect(link.html()).toBe("<br>mire<br>");
				expect(link.attr("passage-name")).toBe("mire");
			});
		});
		describe("proper link syntax", function() {
			it("consists of a simple link with <- or ->", function() {
				var expression = runPassage("[[in->out]]").find('tw-expression');
			
				expect(expression.tag()).toBe("tw-expression");
				expect(expression.attr("type")).toBe("macro");
				expect(expression.attr("name")).toBe("link-goto");
			});
			it("only displays the text on the other side of the arrow", function() {
				var expression = runPassage("[[in->out]]").find('tw-expression');
			
				expect(expression.text()).toBe("in");
			});
			it("links to the passage pointed to by the arrow", function() {
				createPassage("", "out");
			
				var link = runPassage("[[in->out]]").find('tw-link');
			
				expect(link.parent().is('tw-expression')).toBe(true);
				expect(link.attr("passage-name")).toBe("out");
			
				link = runPassage("[[out<-in]]").find('tw-link');
			
				expect(link.parent().is('tw-expression')).toBe(true);
				expect(link.attr("passage-name")).toBe("out");
			});
			it("uses the rightmost right arrow (or, in its absence, leftmost left arrow) as the separator", function() {
				createPassage("", "E");
			
				var link = runPassage("[[A->B->C->D->E]]").find('tw-link');
			
				expect(link.text()).toBe("A->B->C->D");
				expect(link.attr("passage-name")).toBe("E");
			
				link = runPassage("[[E<-D<-C<-B<-A]]").find('tw-link');
			
				expect(link.text()).toBe("D<-C<-B<-A");
				expect(link.attr("passage-name")).toBe("E");
			
				link = runPassage("[[A<-B<-C->D->E]]").find('tw-link');
			
				expect(link.attr("passage-name")).toBe("E");
			
				createPassage("", "C<-D<-E");
				link = runPassage("[[A->B->C<-D<-E]]").find('tw-link');
			
				expect(link.attr("passage-name")).toBe("C<-D<-E");
			});
		});
	});
});
