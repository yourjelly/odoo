/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";
import { _t } from "@web/core/l10n/translation";
import { rpc } from "@web/core/network/rpc";


publicWidget.registry.websiteEventModalEmailReminder = publicWidget.Widget.extend({
    template: 'website_event_track.modal_email_reminder',
    selector: '.o_wetrack_js_modal_email_reminder',
    events: {
        'click .o_form_button_cancel': '_remove',
        'submit #email_reminder_form': '_submit',
    },

    /**
     * @override
     */
    init: function (trackId) {
        this._super.apply(this, arguments);
        this.trackId = trackId
        this.notification = this.bindService("notification");
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
        rpc('/event/add_session_email_reminder', Object.fromEntries(new FormData(form[0]).entries())).then( (result) => {
            this.notification.add(_t('Track successfully added to your favorites. Check your email to add them to your agenda.'), {
                type: 'info',
                className: 'o_send_email_reminder_success'
            });
        });
        this._remove();
    },
});

export default publicWidget.registry.websiteEventTrackReminder;
