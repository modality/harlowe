#Harlowe - the default [Twine 2](https://bitbucket.org/klembot/twinejs) story format.

Rough documentation is at http://twine2.neocities.org/

###1.1.0 changes (unreleased):

####Bugfixes

 * Fixed a somewhat long-standing bug where certain passage elements were improperly given transition attributes during rendering.
 * Fixed a bug in the heading syntax which caused it to be present in the middle of lines rather than just the beginning.
 * Now, if text markup potentially creates empty HTML elements, these elements are not created.
 * Fixed nested list items in both kinds of list markup. Formerly, writing nested lists (with either bullets or numbers) wouldn't work at all.
 * Fixed a bug where the collapsed syntax wouldn't work for runs of just whitespace.
 * Also, explicit `<br>`s are now generated inside the verbatim syntax, fixing a minor browser issue where the text, when copied, would lack line breaks.
 * Changed the previous scrolling fix so that, in non-stretchtext settings, the page scrolls to the top of the `<tw-story>`'s parent element (which is usually, but not always, `<body>`) instead of `<html>`.
 * Fixed a bug where the (move:) macro didn't work on data structures with compiled properties (i.e. arrays).
 * Now, the error message for NaN computations (such as `(log10: 0)`) is more correct.
 * Now, if `(number:)` fails to convert, it prints an error instead of returning NaN.
 * Now, the error message for incorrect array properties is a bit clearer.
 * Fixed a bug where objects such as `(print:)` commands could be `+`'d (e.g. `(set: $x to (print: "A") + (print: "B"))`), with unfavourable results.
 * Fixed a bug where the "Story stylesheet" element was attached between `<head>` and `<body>`. This should have had no obvious effects in any browser, but was untidy anyway.
 * `(substring:)` and `(subarray:)` now properly treat negative indices: you can use them in both positions, and in any order. Also, they now display an error if 0 or NaN is given as an index.
 * Fixed a bug where the `2ndlast`, `3rdlast` etc. sequence properties didn't work at all.
 * Fixed a bug where datamaps would not be considered equal by `is`, `is in` or `contains` if they had the same key/value pairs but in a different order. From now on, datamaps should be considered unordered.
 * Fixed the scroll-to-top functionality not working on some versions of Chrome.
 * Now, if the `<tw-storydata>` element has an incorrect startnode attribute, the `<tw-passagedata>` with the lowest pid will be used. This fixes a rare bug with compiled stories.
 * Fixed a `(goto:)` crash caused by having a `(goto:)` in plain passage prose instead of inside a hook.
 * Optimised the TwineMarkup lexer a bit, improving passage render times.
 * Now, the style changer commands do not wrap arbitrary HTML around the hooks' elements, but by altering the `<tw-hook>`'s style attribute. This produces flatter DOM trees (admittedly not that big a deal) and has made several macros' behaviour more flexible (for instance, (text-style:"shadow") now properly uses the colour of the text instead of defaulting to black).
 * Now, during every `(set:)` operation on a TwineScript collection such as a datamap or array, the entire collection is cloned and reassigned to that particular moment's variables. Thus, the collection can be rolled back when the undo button is pressed.
 * Fixed some bugs where "its" would sometimes incorrectly be parsed as "it" plus the text "s".
 * Improved the collapsing whitespace syntax (`{` and `}`)'s handling of whitespace considerably. Now, whitespace between multiple invisible elements, like `(set:)` macro calls, should be removed outright and not allowed to accumulate.
    * Furthermore, it can be safely nested inside itself, and will no longer collapse whitespace inside macros' strings, or HTML tags' attributes.
 * Fixed a bug where enchantment event handlers (such as those for `(click:)`) could potentially fail to load.

####Alterations

 * TwineScript strings are now Unicode-aware. Due to JavaScript's use of UCS-2 for string indexing, Unicode astral plane characters (used for most non-Latin scripts) are represented as 2 characters instead of a single character. This issue is now fixed in TwineScript: strings with Unicode astral characters will now have correct indexing, length, and `(substring:)` behaviour.
 * Positional property indices are now case-insensitive - `1ST` is the same as `1st`.
 * `(text:)` now only works on strings, numbers, booleans and arrays, because the other datatypes cannot meaningfully be transformed into text.
 * Now, you can't use the `and`, `or` and `not` operators on non-boolean values. So, one must explicitly convert said values to boolean using `is not 0` and such instead of assuming it's boolean.
 * Altered the CSS of `<tw-story>` to use vertical padding instead of vertical margins.
 * Now, division operators will produce an error if used to divide by zero.
 * Reordered the precedence of `contains` - it should now be higher than `is`, so that e.g. `(print: "ABC" contains "A" is true)` should now work as expected.
 * A few variable names in TwineScript are now controlled by the game engine, and are read-only. These are `$Passages`, `$Design`, and `$Saves`. See below for explanations as to what purpose these now serve.
 * Now, giving a datamap to `(print:)` will cause that macro to print out the datamap in a rough HTML `<table>` structure, showing each key and value. This is a superior alternative to just printing "[object Object]".
 * Now, variables and barename properties must have one non-numeral in their name. This means that, for instance, `$100` is no longer regarded as a valid variable name.
 * Debug Mode: now, macros show their full call (e.g. `(if: $a > 1)` rather than just `if`), and the verbatim syntax/hooks show their brackets at their start and end.

####New Features

 * Added computed property indexing syntax to TwineScript. Properties on collections can now be accessed via a variant of the possessive syntax: `$a's (expression)`.
    * Using this syntax, you can supply numbers as 1-indexed indices to arrays and strings. So, `"Red"'s $i`, where `$i` is 1, would be the same as `"Red"'s 1st`. Note, however, that if `$i` was the string `"1st"`, it would also work too - but not if it was just the string `"1"`.
 * Links and buttons in compiled stories are now accessible via the keyboard's Tab and Enter keys. `<tw-link>`, `<tw-icon>` and other clickable elements now have a tabindex attribute, and Harlowe sets up an event handler that allows them to behave as if clicked when the Enter key is pressed.
 * Added 'error explanations', curt sentences which crudely explain the error message, which are visible as fold-downs on each error message.
 * Added `(nonzero:)` and `(nonempty:)` macros.
    * `(nonzero:)`, aliased as `(first-nonzero:)` is designed to work like the short-circuiting JS `||` operator. It accepts any quantity of numbers and returns the first given argument which isn't zero.
    * `(nonempty:)` is an equivalent, accepting strings, arrays, sets and maps.
 * TwineScript now supports single trailing commas in macro calls. `(a: 1, 2,)` is treated the same as `(a: 1,2)`. This is in keeping with JS, which allows trailing commas in array and object literals (but not calls, currently).
 * Added `of` property indexing as a counterpart to possessive(`x's y`) indexing.
    * Now, you can alternatively write `last of $a` instead of `$a's last`, or `passages of $style` instead of `$style's passages`. This is intended to provide a little more flexibility in phrasing/naming collection variables - although whether it succeeds is in question.
    * This syntax should also work with computed indexing (`(1 + 2) of $a`) and `it` indexing (`1st of it`).
 * Added `(savegame:)` and `(loadgame:)`.
    * `(savegame:)` saves the game session's state to the browser's local storage. It takes 2 values: a slot name string (you'll usually just use a string like "A" or "B") and a filename (something descriptive of the current game's state). Example usage: `(savegame: "A", "Beneath the castle catacombs")`.
    * `(savegame:)` currently has a significant **limitation**: it will fail if the story's variables contain values which aren't strings, booleans, arrays, datamaps or datasets. If, for instance, you put a changer command in a variable, like `(set: $fancytext to (font:"Arnold Bocklin"))`, `(savegame:)` would no longer work. I must apologise for this, and hope to eliminate this problem in future versions.
    * `(savegame:)` evaluates to a boolean `true` if it succeeds and `false` if it fails (because the browser's local storage is disabled for some reason). You should write something like `(if: (savegame:"A","At the crossroads") is false)[The game could not be saved!]` to provide the reader with an apology if `(savegame:)` fails.
    * `(loadgame:)` takes one value - a slot name such as that provided to `(savegame:)` - and loads a game from that slot, replacing the current game session entirely. Think of it as a `(goto:)` - if it succeeds, the passage is immediately exited.
    * Harlowe automatically records the names of existing save files in the datamap `$Saves`. The expression `$Saves contains "Slot name"` will be `true` if that slot name is currently used.
    * The filename of a file in a slot can be displayed thus: `(print: $Saves's ("Slot name"))`.
 * `<script>` tags in passage text will now run. However, their behaviour is not well-defined yet - it's unclear even to me what sort of DOM they would have access to.
 * `<style>` tags in passage text can now be used without needing to escape their contents with the verbatim syntax (backticks).
 * `$Design` is a special datamap variable created at startup by Harlowe. Its purpose is to allow the author to roughly style their story without CSS. It currently has the data keys "Passages", "Page", "Links" and "Hovering Links". You can style these entities as if they were hooks: `(set: $Design's Passages to (font: "Courier") + (text-color: gray))`, for instance, will cause the passages to be styled using those commands, from now on.
 * `$Passages` is another special datamap variable - it's a "datamap of datamaps", where each data key is the name of a passage in the story, and each data value is a datamap containing information about that passage. For instance, you can obtain the prose for the "Cloister" passage with `$Passages's Cloister's prose`, or the tags with `$Passages's Cloister's tags`.
    * You can also edit these datamaps, and rewrite the story while it's being played - or, add a new passage datamap to `$Passages`, by running `(set: $Passages's ("My New Passage") to (datamap: "code", "My passage's text", "tags", (a:"my-tag", "my-tag-2"))` etc.
 * Added `(position-x:)` and `(position-y:)`: shorthands for giving a hook the CSS property `position:absolute` and a percentage `left` or `top`. The percentage argument is a number, ostensibly from 0 to 1, but potentially any number. One problem: while it should position the hook relative to the passage, it doesn't work correctly when nested - because, of course, `position:absolute` uses the nearest positioned element.
 * Added `(css:)` as a 'last resort' solution for styling elements, which is essentially the same as a raw HTML `<span style='...'>` tag, but can be combined with other changer commands. I feel obliged to offer this to provide some CSS-familiar users some access to higher functionality, even though it's not intended for general use in place of `(text-style:)`, `(position-x:)` or whatever.
 * Added `(align:)`, a macro form of the aligner syntax. It accepts a string containing an ASCII arrow of the same type that makes up the syntax ('==>', '=><==', etc). 
 * Added special behaviour for passages tagged with `passage-setup` or `story-setup`: their code will be *automatically* `(display:)`ed at the start of passages, allowing you to set up code actions (like `(click: ?switch)` etc.) or give passages a textual header. `passage-setup` passages are prepended to every passage, whereas `story-setup` passages are only prepended to the first passage in the game.

###1.0.1 changes:

####Bugfixes

* The story stylesheet and Javascript should now be functioning again.
* Fixed a bug where `(display:)`ed passage code wasn't unescaped from its HTML source.
* Fixed a bug preventing pseudo-hooks (strings) being used with macros like `(click:)`. The bug prevented the author from, for instance, writing `(click: "text")` to apply a click macro to every instance of the given text.
* Fixed a bug where string literal escaping (e.g. `'Carl\'s Fate'`) simply didn't work.
* Fixed a bug where quotes can't be used inside the link syntax - `[["Hello"]]` etc. now works again.
* Fixed a markup ambiguity between the link syntax and the hook syntax. This problem primarily broke links nested in hooks, such as `[[[link]]]<tag|`.
* Fixed `(reload:)` and `(gotoURL:)`, which previously errored regardless of input.
* Fixed a bug where assigning from a hookset to a variable, such as `(set: $r to ?l)`, didn't work right.
* Fixed a bug where `(else-if:)` didn't work correctly with successive `(else:)`s.
* Fixed a bug where `<tw-expression>`s' js attrs were incorrectly being unescaped twice, thus causing macro invocations with `<` symbols in it to break.
* Fixed a bug preventing the browser window from scrolling to the top on passage entry.
* Fixed a bug where the header syntax didn't work on the first line of a passage.

####Alterations

* Characters in rendered passages are no longer individually wrapped in `<tw-char>` elements, due to it breaking RTL text. This means CSS that styles individual characters currently cannot be used.
* Eliminated the ability to use property reference outside of macros - you can no longer do `$var's 1st`, etc. in plain passage text, without wrapping a `(print:)` around it.
* You can no longer attach text named properties to arrays using property syntax (e.g. `(set: $a's Garply to "grault")`). Only `1st`, `2ndlast`, etc. are allowed.
* Altered `is`, `is in` and `contains` to use compare-by-value. Now, instead of using JS's compare-by-reference semantics, TwineScript compares containers by value - that is, by checking if their contents are identical. This brings them into alignment with the copy-by-value semantics used by `(set:)` and such.

####New Features

* Added the ability to property-reference arbitrary values, not just variables. This means that you can now use `(history:)'s last`, or `"Red"'s 1st` as expressions, without having to put the entity in a variable first.
