/** @odoo-module alias=website_event.set_customize_options **/

import CustomizeMenu from "website.customizeMenu";
import publicWidget from "web.public.widget";

const EventSpecificOptions = publicWidget.Widget.extend({
    template: 'website_event.customize_options',
    xmlDependencies: ['/website_event/static/src/xml/customize_options.xml'],

    /**
     * @override
     */
    start() {
        this._super(...arguments);
        this.$submenuInput = this.$('#display-website-menu');
        this.modelName = this._getEventObject().model;
        this.eventId = this._getEventObject().id;
        this._initCheckbox();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _getCheckboxFields() {
        return ['website_menu', 'website_url'];
    },

    _getCheckboxFieldMatch(checkboxField) {
        if (checkboxField === 'website_menu') {
            return this.$submenuInput;
        }
    },

    _getEventObject() {
        var repr = $('html').data('main-object');
        var m = repr.match(/(.+)\((\d+),(.*)\)/);
        return {
            model: m[1],
            id: m[2] | 0,
        };
    },

    _initCheckbox() {
        var self = this;
        this._rpc({
            model: this.modelName,
            method: 'read',
            args: [
                [this.eventId],
                this._getCheckboxFields()
            ],
        }).then((data) => {
            self._initCheckboxCallback(data);
        });
    },

    _initCheckboxCallback(rpcData) {
        if (rpcData[0]['website_menu']) {
            var submenuInput = this._getCheckboxFieldMatch('website_menu');
            submenuInput.attr('checked', 'checked');
        }
        this.eventUrl = rpcData[0]['website_url'];
    },

});

CustomizeMenu.include({
    _getEventObject() {
        var repr = $('html').data('main-object');
        var m = repr.match(/(.+)\((\d+),(.*)\)/);
        return {
            model: m[1],
            id: m[2] | 0,
        };
    },

    /**
     * @override
     * @param {Event} ev 
     */
    _onCustomOptionClick(ev) {
        this._super(...arguments);
        if (this.eventOptions.modelName === "event.event") {
            const $currentTarget = $(ev.currentTarget);
            const $inputOption = $($currentTarget.find('input'));
            if ($inputOption[0].id === 'display-website-menu') {
                var checkboxValue = $inputOption.is(':checked');
                this._toggleSubMenuDisplay(!checkboxValue);
            }
        }
    },

    _toggleSubMenuDisplay(val) {
        this._rpc({
            model: this.eventOptions.modelName,
            method: 'toggle_website_menu',
            args: [[this.eventOptions.eventId], val],
        }).then(() => {
            window.location.reload();
        });
    },

    _loadCustomizeOptions() {
        var self = this;
        var def = this._super(...arguments);
        return def.then(() => {
            if (!self.__eventOptionsLoaded && self._getEventObject().model === 'event.event') {
                self.__eventOptionsLoaded = true;
                self.eventOptions = new EventSpecificOptions(self);
                // If this is the first customize menu, add the divider at top
                if (!self.$('.dropdown-divider').length) {
                    self.$('.dropdown-menu').append($('<div/>', {
                        class: 'dropdown-divider',
                        role: 'separator',
                    }));
                }
                self.eventOptions.insertAfter(self.$el.find('.dropdown-divider:first()'));
            }
        });
    },
});

export default {
    EventSpecificOptions: EventSpecificOptions,
};
