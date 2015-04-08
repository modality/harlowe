define(['macros', 'utils'], function(Macros, Utils) {
  "use strict";

  var Any = Macros.TypeSignature.Any,
      optional = Macros.TypeSignature.optional;

  Macros.add
    ("shareButtons",
      function shareButtons(_, shareText, imageName) {
        if(window.BF_GAME) {
          window.BF_GAME.Instance.shareButtons(shareText, imageName);
        } else {
          return {
            TwineScript_ObjectName:
              "a (shareButtons) command",

            TwineScript_TypeName:
              "a (shareButtons) command",

            TwineScript_Print: function() {
              return '<tw-expression type="macro" name="link-goto"><tw-link tabindex="0" class="visited" passage-name="Start">Share Buttons Go Here</tw-link></tw-expression>';
            },
          }
        }
      },
      [optional(Any), optional(Any)]
    )

    ("staticImage",
      function staticImage(_, url) {
        if(window.BF_GAME) {
          url = window.BF_GAME.Instance.staticImage(url);
        } else {
          url = "images_go_here/" + url;
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

    ("googleTrack",
      function googleTrack(_, ev, val) {
        if(window.BF_GAME) {
          window.BF_GAME.Instance.googleTrack(ev, val);
        }
      },
      [Any, Any]
    )
    ;
});
