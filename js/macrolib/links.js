define(['jquery', 'macros', 'utils', 'utils/selectors', 'state', 'engine', 'datatypes/changercommand', 'internaltypes/twineerror'],
function($, Macros, Utils, Selectors, State, Engine, ChangerCommand, TwineError) {
	"use strict";
	/*
		This module defines the behaviour of links in Harlowe - both
		the normal passage links, and the (link:) macro's links.
		But, this does not include (click:) enchantments, which
		are technically not links (but behave identically).
	*/
	var optional = Macros.TypeSignature.optional;
	
	/*
		Register the event that this enchantment responds to
		in a jQuery handler.
		
		Sadly, since there's no permitted way to attach a jQuery handler
		directly to the triggering element, the "actual" handler
		is "attached" via a jQuery .data() key, and must be called
		from this <html> handler.
	*/
	$(document).ready(function() {
		$(Utils.storyElement).on(
			/*
				The jQuery event namespace is "passage-link".
			*/
			"click.passage-link",
			Selectors.internalLink,
			function clickLinkEvent() {
				var link = $(this),
					/*
						This could be a (link:) link. Such links' events
						are, due to limitations in the ChangeDescriptor format,
						attached to the <tw-expression> enclosing it.
					*/
					event = link.parent().data('clickEvent');
			
				if (event) {
					event(link);
					return;
				}
				/*
					If no event was registered, then this must be
					a passage link.
				*/
				var next = link.attr('passage-name');
			
				if (next) {
					// TODO: stretchtext
					Engine.goToPassage(next,false);
				}
			}
		);
	});
	
	/*d:
		(link: String) -> Command
		
		Makes a command to create a special link that can be used to show spans of text.
		
		Rationale:
		
		As you're aware, links are what the player uses to traverse your story. However,
		links can also be used to simply display text or run macros inside hooks. Just
		use the (link:) macro, and the entire hook will not run or appear at all until the
		player clicks the link.
		
		Details:
		This creates a link which is visually indistinguishable from normal passage links.
		
		See also:
		(link-goto:), (click:)
	*/
	Macros.addChanger
		(["link"], function(_, expr) {
			return ChangerCommand.create("link", [expr]);
		},
		function(desc, text) {
			var innerProse = desc.prose;
			desc.prose = '<tw-link tabindex=0>' + text + '</tw-link>';
			desc.append = "replace";
			desc.data = {
				clickEvent: function() {
					desc.prose = innerProse;
					desc.section.renderInto(innerProse + "", null, desc);
				},
			};
		},
		[String]);
	
	/*
		(link-goto:) is an eager version of (link:...)[(goto:...)], where the
		passage name ((goto:)'s argument) is evaluated alongside (link:)'s argument.
		It is also what the standard link syntax desugars to.
	*/
	Macros.add
		(["link-goto"], function(section, text, passage) {
			/*
				Return a new (link-goto:) object.
			*/
			return {
				TwineScript_TypeName: "a (link-goto: "
					+ Utils.toJSLiteral(text) + ", "
					+ Utils.toJSLiteral(passage) + ") command",
				TwineScript_ObjectName: "a (link-goto:) command",
				
				TwineScript_Print: function() {
					var visited = -1, error, passageName;
					/*
						The string representing the passage name is evaluated as TwineMarkup here -
						the link syntax accepts TwineMarkup in both link and passage position
						(e.g. [[**Go outside**]], [[$characterName->$nextLocation]]), and the text
						content of the evaluated TwineMarkup is regarded as the passage name,
						even though it is never printed.
						
						One concern is that of evaluation order: the passage name is always evaluated
						before the link text, as coded here. But, considering the TwineMarkup parser
						already discards the ordering of link text and passage name in the link
						syntax ([[a->b]] vs [[b<-a]]) then this can't be helped, and probably doesn't matter.
					*/
					passageName = section.evaluateTwineMarkup(Utils.unescape(passage || text));
					
					/*
						If a <tw-error> was returned by evaluateTwineMarkup, replace the link with it.
					*/
					if (passageName instanceof $) {
						/*
							section.runExpression() is able to accept jQuery objects
							being returned from TwineScript_Print().
						*/
						return passageName;
					}
					/*
						Check that the passage is indeed available.
					*/
					if ((error = TwineError.containsError(State.passageExists(passageName)))) {
						/*
							Since the passage isn't available, create a broken link.
							TODO: Maybe this should be an error as well??
						*/
						return '<tw-broken-link passage-name="' + passageName + '">'
							+ (text || passage)
							+ '</tw-broken-link>';
					}
					/*
						Previously visited passages may be styled differently compared
						to unvisited passages.
					*/
					visited = (State.passageNameVisited(passageName));
					
					/*
						This regrettably exposes the destination passage name in the DOM...
						but I hope to somehow eliminate this in the near future.
					*/
					return '<tw-link tabindex=0 ' + (visited > 0 ? 'class="visited" ' : '')
						+ 'passage-name="' + passageName
						+ '">' + (text || passage) + '</tw-link>';
				}
			};
		},
		[String, optional(String)]);
});
