odoo.define('website_event_meet.website_event_create_room_button', function (require) {
'use strict';

let publicWidget = require('web.public.widget');
let core = require('web.core');
let QWeb = core.qweb;

publicWidget.registry.websiteEventCreateMeetingRoom = publicWidget.Widget.extend({
    selector: '.o_wevent_create_room_button',
    xmlDependencies: ['/website_event_meet/static/src/xml/website_event_meeting_room.xml'],
    events: {
        'click': '_onClick',
    },

    start: async function () {

        const langs = await this._rpc({
            model: 'res.lang',
            method: 'search_read',
            args: [[], ["name", "code"]],
        });

        this.$createModal = $(QWeb.render(
            'create_meeting_room_modal',
            {
                csrf_token: odoo.csrf_token,
                event: this.$el.data("event"),
                langs: langs,
            }
        ));

        this.$createModal.appendTo(this.$el);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onClick: async function () {
        this.$createModal.modal('show');
    },
});

return publicWidget.registry.websiteEventMeetingRoom;

});
