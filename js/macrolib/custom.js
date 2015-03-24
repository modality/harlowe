define(['macros', 'utils'], function(Macros, Utils) {
  "use strict";
  
	var
		Any = Macros.TypeSignature.Any;

  Macros.add
    ("shareButtons",
      function shareButtons(_, shareText, imageName) {
        if(BF_GAME) {
          BF_GAME.Instance.shareButtons(shareText, imageName);
        }
      },
      [Any, Any]
    )

    ("staticImage",
      function staticImage(_, url) {
        if(BF_GAME) {
          url = BF_GAME.Instance.staticImage(url);
        }

        return {
          TwineScript_ObjectName:
            "a (staticImage: " + Utils.toJSLiteral(url) + ") command",

          TwineScript_TypeName:
            "a (staticImage:) command",

          TwineScript_Print: function() {
            return '<img src="'+url+'" />';
          },
        };
      },
      [Any]
    )
    ;
});
