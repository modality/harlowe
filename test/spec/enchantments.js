describe("enchantment changers", function() {
	'use strict';
	describe("(click:)", function() {
		it("accepts either 1 hookset or 1 string", function() {
			expectMarkupToNotError("(print:(click:?foo))");
			expectMarkupToNotError("(print:(click:'baz'))");

			expectMarkupToError("(print:(click:?foo, ?bar))");
			expectMarkupToError("(print:(click:?foo, 'baz'))");
			expectMarkupToError("(print:(click:'baz', 'baz'))");
		});
		describe("given a single hook", function() {
			it("enchants the selected hook as a link", function() {
				var p = runPassage("[cool]<foo|(click:?foo)[]").find('tw-enchantment');
				expect(p.length).toBe(1);
				expect(p.hasClass('link') && p.hasClass('enchantment-link')).toBe(true);
				
				p = runPassage("(click:?foo)[][cool]<foo|").find('tw-enchantment');
				expect(p.length).toBe(1);
				expect(p.hasClass('link') && p.hasClass('enchantment-link')).toBe(true);
			});
			it("renders the attached hook when the enchantment is clicked", function() {
				var p = runPassage("[cool]<foo|(click:?foo)[beans]");
				expect(p.text()).toBe("cool");
				p.find('tw-enchantment').click();
				expect(p.text()).toBe("coolbeans");
			});
			it("disenchants the selected hook when the enchantment is clicked", function() {
				var p = runPassage("[cool]<foo|(click:?foo)[beans]");
				expect(p.text()).toBe("cool");
				p.find('tw-enchantment').click();
				expect(p.find('tw-enchantment').length).toBe(0);
			});
			it("nested enchantments are triggered one by one", function() {
				var p = runPassage("[[cool]<foo|]<bar|(click:?foo)[beans](click:?bar)[lake]");
				expect(p.text()).toBe("cool");
				p.find('tw-enchantment').first().click();
				expect(p.text()).toBe("coollake");
				p.find('tw-enchantment').first().click();
				expect(p.text()).toBe("coolbeanslake");
			});
			it("affects hooks inside other hooks", function() {
				var p = runPassage("(if:true)[[cool]<foo|](click:?foo)[beans]").find('tw-enchantment');
				expect(p.length).toBe(1);
				expect(p.hasClass('link') && p.hasClass('enchantment-link')).toBe(true);
			});
		});
		describe("given multiple hooks", function() {
			it("enchants each selected hook as a link", function() {
				var p = runPassage("[very]<foo|[cool]<foo|(click:?foo)[]").find('tw-enchantment');
				expect(p.length).toBe(2);
				p = runPassage("(click:?foo)[][very]<foo|[cool]<foo|").find('tw-enchantment');
				expect(p.length).toBe(2);
			});
			it("renders the attached hook when either enchantment is clicked", function() {
				['first','last'].forEach(function(e) {
					var p = runPassage("[very]<foo|[cool]<foo|(click:?foo)[beans]");
					expect(p.text()).toBe("verycool");
					p.find('tw-enchantment')[e]().click();
					expect(p.text()).toBe("verycoolbeans");
				});
			});
			it("disenchants all selected hooks when the enchantment is clicked", function() {
				['first','last'].forEach(function(e) {
					var p = runPassage("[very]<foo|[cool]<foo|(click:?foo)[beans]");
					p.find('tw-enchantment')[e]().click();
					expect(p.find('tw-enchantment').length).toBe(0);
				});
			});
			it("enchants additional matching hooks added to the passage", function() {
				var p = runPassage("[very]<foo|(click:?foo)[](link:)[[cool]<foo|]");
				p.find('tw-expression[name=link]').click();
				expect(p.find('tw-enchantment').length).toBe(2);
			});
		});
		describe("given strings", function() {
			it("enchants each found string in the passage", function() {
				var p = runPassage("wow(click:'wow')[]wow").find('tw-enchantment');
				expect(p.length).toBe(2);
				expect(p.hasClass('link') && p.hasClass('enchantment-link')).toBe(true);
			});
			it("renders the attached hook when any enchanted string is clicked", function() {
				['first','last'].forEach(function(e) {
					var p = runPassage("wow(click:'wow')[ gosh ]wow");
					expect(p.text()).toBe("wowwow");
					p.find('tw-enchantment')[e]().click();
					expect(p.text()).toBe("wow gosh wow");
				});
			});
			it("disenchants all selected strings when the enchantment is clicked", function() {
				['first','last'].forEach(function(e) {
					var p = runPassage("wow(click:'wow')[ gosh ]wow");
					p.find('tw-enchantment')[e]().click();
					expect(p.find('tw-enchantment').length).toBe(0);
				});
			});
			it("nested enchantments are triggered one by one", function() {
				var p = runPassage("wow(click:'wow')[gosh](click:'w')[geez]");
				expect(p.text()).toBe("wow");
				p.find('tw-enchantment').first().click();
				expect(p.text()).toBe("wowgosh");
				p.find('tw-enchantment').first().click();
				expect(p.text()).toBe("wowgoshgeez");
				
				p = runPassage("wow(click:'w')[gosh](click:'wow')[geez]");
				expect(p.text()).toBe("wow");
				p.find('tw-enchantment').first().click();
				expect(p.text()).toBe("wowgosh");
				p.find('tw-enchantment').first().click();
				expect(p.text()).toBe("wowgoshgeez");
			});
			it("enchants additional matching strings added to the passage", function() {
				var p = runPassage("wow|(click:'wow')[](link:)[wow]");
				p.find('tw-expression[name=link]').click();
				expect(p.find('tw-enchantment').length).toBe(2);
			});
		});
	});
});
