odoo.define('website_event_meet.set_customize_options', function (require) {
"use strict";

var EventSpecificOptions = require('website_event.set_customize_options').EventSpecificOptions;

EventSpecificOptions.include({
    xmlDependencies: (EventSpecificOptions.prototype.xmlDependencies || [])
        .concat([
            '/website_event_meet/static/src/xml/customize_options.xml',
        ]),

    events: _.extend({}, EventSpecificOptions.prototype.events, {
        'change #display-community': '_onDisplayCommunityChange',
    }),

    start: function () {
        this.$displayCommunityInput = this.$('#display-community');
        this._super.apply(this, arguments);
    },

    _initCheckbox: function () {
        this._rpc({
            model: this.modelName,
            method: 'read',
            args: [[this.eventId], ['website_url', 'website_community']],
        }).then((data) => {
            if (data[0]['website_community']) {
                this.$displayCommunityInput.attr('checked', 'checked');
            }
            this.eventUrl = data[0]['website_url'];
        });
    },

    _onDisplayCommunityChange: function () {
        var checkboxValue = this.$displayCommunityInput.is(':checked');
        this._toggleDisplayCommunity(checkboxValue);
    },

    _toggleDisplayCommunity: function (val) {
        var self = this;
        this._rpc({
            model: this.modelName,
            method: 'write',
            args: [[this.eventId], {website_community: val}],
        }).then(function () {
            self._reloadEventPage();
        });
    }

});

});
