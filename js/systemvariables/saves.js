define([], function() {
	"use strict";
	/**
		$Saves
		A userland registry of save slots, mapping the slot name to the save file name.
		This, of course, is updated frequently.
		
		@class $Saves
		@static
	*/
	
	/*
		This simple method refreshes the Saves datamap, rereading all of the localStorage keys
		with save slot-related names into the map.
	*/
	function repopulate() {
		var i = 0, key;
		/*
			First, remove the old keys from the Saves map.
		*/
		Saves.clear();
		/*
			Iterate over all the localStorage keys using this somewhat clunky do-loop.
		*/
		do {
			key = localStorage.key(i);
			i += 1;
			if (key && key.startsWith("(Saved Game) ")) {
				// Trim off the prefix
				key = key.slice(13);
				// Populate the Saves map with the save slot name.
				Saves.set(key, localStorage.getItem("(Saved Game Filename) " + key));
			}
		}
		while(key);
	}
	
	var Saves = Object.assign(new Map([]),{
		repopulate: repopulate,
		TwineScript_TypeName: "$Saves datamap",
		TwineScript_ObjectName: "the $Saves datamap",
		TwineScript_Sealed: true,
	});
	
	/*
		We don't have to wait until the game has loaded to do this.
	*/
	repopulate();
	
	return Saves;
});
