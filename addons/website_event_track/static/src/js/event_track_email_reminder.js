/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";
import { rpc } from "@web/core/network/rpc";
import { Component } from "@odoo/owl";

publicWidget.registry.websiteEventModalEmailReminder = publicWidget.Widget.extend({
    selector: '.o_wetrack_js_email_modal_reminder',
    start: function (){
        console.log("ici you are in the modal.");
    }

    //--------------------------------------------------------------------------
    // Handlers
    //-------------------------------------------------------------------------

});

export default publicWidget.registry.websiteEventTrackReminder;
