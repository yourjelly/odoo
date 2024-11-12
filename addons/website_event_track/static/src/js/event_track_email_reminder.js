/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";
import { rpc } from "@web/core/network/rpc";

publicWidget.registry.websiteEventModalEmailReminder = publicWidget.Widget.extend({
    template: 'website_event_track.modal_email_reminder',
    selector: '.o_wetrack_js_modal_email_reminder',
    events: {
        'click .btn-close': '_remove',
        'click .btn-cancel': '_remove',
        'submit #email_reminder_form': '_submit',
    },

    /**
     * @override
     */
    init: function (trackId) {
        this._super.apply(this, arguments);
        this.trackId = trackId
    },

    //--------------------------------------------------------------------------
    // Handlers
    //-------------------------------------------------------------------------

    _remove: function (){
        this.$el.remove();
    },

    _submit: function (ev){
        ev.preventDefault();
        var form = this.$(ev.target);
        rpc(form.attr('action'), Object.fromEntries(new FormData(form[0]).entries()));
        this._remove();
    },
});

export default publicWidget.registry.websiteEventTrackReminder;
