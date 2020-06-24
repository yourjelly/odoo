odoo.define("website_event_online.jitsi_room_mixin", function (require) {
'use strict';

let config = require("web.config");

/**
  * This mixin embed methods for the creation of Jitsi rooms on a DOM element as well as
  * a method to join the room on mobile.
  */
let WebsiteEventJitsiRoomMixin = {

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
      * Redirect on the Jitsi mobile application if we are on mobile.
      *
      * @private
      * @param {string} roomName
      * @returns {boolean} true is we were redirected to the mobile application
      */
    _openMobileApplication: async function (roomName) {
        if (config.device.isMobile) {
            // we are on mobile, open the room in the application
            window.location = `intent://meet.jit.si/${roomName}#Intent;scheme=org.jitsi.meet;package=org.jitsi.meet;end`;
            return true;
        }
        return false;
    },

    /**
      * Create a Jitsi room on the given DOM element.
      *
      * @private
      * @param {string} roomName
      * @param {jQuery} $parentNode
      * @returns {JitsiRoom} the newly created Jitsi room
      */
    _createJitsiRoom: async function (roomName, $parentNode) {
      await this._loadJisti();
        const domain = "meet.jit.si";
        const options = {
            roomName: roomName,
            width: "100%",
            height: "100%",
            parentNode: $parentNode[0],
            configOverwrite: {disableDeepLinking: true},
        };
        return new window.JitsiMeetExternalAPI(domain, options);
    },

    /**
      * Load the Jitsi external library if necessary.
      *
      * @private
      */
    _loadJisti: async function () {
      if (!window.JitsiMeetExternalAPI) {
          await $.ajax({
              url: "https://meet.jit.si/external_api.js",
              dataType: "script",
          });
      }
    },

};

return WebsiteEventJitsiRoomMixin;

});
