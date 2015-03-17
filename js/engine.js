define(['jquery', 'utils', 'utils/selectors', 'state', 'section'],
function ($, Utils, Selectors, State, Section) {
	"use strict";
	
	/**
		A singleton class responsible for rendering passages to the DOM.

		@class Engine
		@static
	*/
	
	/**
		Story options, loaded at startup and provided to other modules that may use them.
		
		Implemented values:
		
		debug : debug mode is ready. Click the bug icon to reveal all macro spans.
		undo : enable the undo button.
		redo : enable the redo button.
		
		@property {Object} options
	*/
	var options = Object.create(null);

	/**
		Creates the HTML structure of the <tw-passage>. Sub-function of showPassage().

		@method createPassageElement
		@private
		@return {jQuery} the element
	*/
	function createPassageElement () {
		var container, back, fwd, sidebar;
		container = $('<tw-passage><tw-sidebar>'),
		sidebar = container.children(Selectors.sidebar);
		
		/*
			Generate the HTML for the permalink.
			(This is currently unavailable as of Harlowe 1.0)
		*/
		if (options.permalink && State.save) {
			sidebar.append(
				'<tw-icon tabindex=0 class="permalink" title="Permanent link to this passage"><a href="#' + State.save() + '">&sect;'
			);
		}
		// Apart from the Permalink, the sidebar buttons consist of Undo (Back) and Redo (Forward) buttons.
		back = $('<tw-icon tabindex=0 class="undo" title="Undo">&#8630;</tw-icon>').click(Engine.goBack);
		fwd  = $('<tw-icon tabindex=0 class="redo" title="Redo">&#8631;</tw-icon>').click(Engine.goForward);

		if (State.pastLength <= 0) {
			back.css("visibility", "hidden");
		}
		if (State.futureLength <= 0) {
			fwd.css( "visibility", "hidden");
		}
		sidebar.append(back).append(fwd);

		return container;
	}
	
	/**
		Shows a passage by transitioning the old passage(s) out, and then adds the new passages.

		@method showPassage
		@private
		@param {String} name
		@param {Boolean} stretch Is stretchtext
	*/
	function showPassage (name, stretch) {
		var
			// Passage element to create
			newPassage,
			// Transition ID
			// Temporary measure: must change when customisable links are implemented.
			t8n = "instant",
			// The passage
			// This must use State.variables.Passages instead of SystemVariables/Passages
			// in case the author (set:) a new datamap to it.
			passageData = State.variables.Passages.get(name),
			oldPassages,
			section,
			// The prose to render, which is drawn from both the passageData and the
			// setup passages, if any.
			prose,
			// The <tw-story> element
			story = Utils.storyElement,
			/*
				The <tw-story>'s parent is usually <body>, but if this game is embedded
				in a larger HTML page, it could be different.
			*/
			parent = story.parent();
		/*
			Early exit: the wrong passage name was supplied.
			Author error must never propagate to this method - it should have been caught earlier.
		*/
		if (!passageData || !(passageData instanceof Map) || !passageData.has('prose')) {
			Utils.impossible("Engine.showPassage", "There's no passage with the name \""+name+"\"!");
		}
		
		/*
			Because rendering a passage is a somewhat intensive DOM manipulation,
			the <tw-story> is detached before and reattached after.
		*/
		story.detach();
		
		/*
			Find out how many tw-passage elements there are currently in the
			destination element.
		*/
		oldPassages = Utils.$(story.children(Utils.passageSelector));
		
		/*
			If this isn't a stretchtext transition, send away all of the
			old passage instances.
		*/
		if (!stretch && t8n) {
			Utils.transitionOut(oldPassages, t8n);
		}
		
		newPassage = createPassageElement().appendTo(story);
		
		Utils.assert(newPassage.length > 0);
		
		section = Section.create(newPassage);
		
		/*
			Actually do the work of rendering the passage now.
			First, gather the prose of the passage in question.
		*/
		
		prose = passageData.get('prose');
		
		/*
			Now, we add to it the prose of the 'passage-setup' tagged passages.
			We explicitly include these passages inside <tw-passage-setup> elements
			so that they're visible to the author when they're in debug mode, and can clearly
			see the effect they have on the passage.
		*/
		prose = State.variables.Passages.getTagged('passage-setup').map(function(setupPassage) {
			return "<tw-passage-setup title='"
				+ Utils.escape(setupPassage.get('name'))
				+ "'>"
				+ setupPassage.get('prose')
				+ "</tw-passage-setup>";
		})
		.join('') + prose;
		/*
			We only add the story-setup passages if this is the very first passage.
		*/
		if (State.pastLength <= 0) {
			prose = State.variables.Passages.getTagged('story-setup').map(function(setupPassage) {
				return "<tw-story-setup title='"
					+ Utils.escape(setupPassage.get('name'))
					+ "'>"
					+ setupPassage.get('prose')
					+ "</tw-story-setup>";
			})
			.join('') + prose;
		}
		
		/*
			Then, run the actual passage.
		*/
		section.renderInto(
			prose,
			newPassage,
			/*
				Use the author's styles, assigned using TwineScript,
				as well as this basic, default ChangeDescriptor-like object
				supplying the transition.
			*/
			[{ transition: "dissolve" }]
		);
		
		parent.append(story);
		/*
			In stretchtext, scroll the window to the top of the inserted element,
			minus an offset of 5% of the viewport's height.
			Outside of stretchtext, just scroll to the top of the <tw-story>'s element.
		*/
		scroll(
			0,
			stretch ? newPassage.offset().top - ($(window).height() * 0.05) : story.offset().top
		);
	}
	
	var Engine = {
		
		/**
			Moves the game state backward one turn. If there is no previous state, this does nothing.

			@method goBack
		*/
		goBack: function () {
			//TODO: get the stretch value from state

			if (State.rewind()) {
				showPassage(State.passage);
			}
		},

		/**
			Moves the game state forward one turn, after a previous goBack().

			@method goForward
		*/
		goForward: function () {
			//TODO: get the stretch value from state

			if (State.fastForward()) {
				showPassage(State.passage);
			}
		},

		/**
			Displays a new passage, advancing the game state forward.

			@method goToPassage
			@param {String} id			id of the passage to display
			@param {Boolean} stretch	display as stretchtext?
		*/
		goToPassage: function (id, stretch) {
			// Update the state.
			State.play(id);
			showPassage(id, stretch);
		},
		
		/*
			Displays a new passage WITHOUT changing the game state.
			Used exclusively by state-loading routines.
		*/
		showPassage: showPassage,
		
		options: options,
	};
	
	return Object.freeze(Engine);
});
