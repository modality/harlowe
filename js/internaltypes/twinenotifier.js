define(['jquery', 'utils'], function($, Utils) {
	"use strict";
	/*
		TwineNotifiers are special debug notifications created by the TwineScript runtime in debug mode.
		They are used to signify when a special event has occurred.
	*/
	
	var TwineNotifier = {
		
		create: function(message) {
			if (!message) {
				Utils.impossible("TwineNotifier.create", "called with only 1 string.");
			}
			return Object.assign(Object.create(TwineNotifier), {
				message: message
			});
		},
		
		render: function() {
			/*
				This is attached as an attr instead of body text, so that
				its text isn't considered part of the element by jQuery#text().
			*/
			return $("<tw-notifier>").attr('message', this.message);
		},
	};
	return TwineNotifier;
});
