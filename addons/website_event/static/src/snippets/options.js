/** @odoo-module **/

import options from 'web_editor.snippets.options';

options.registry.WebsiteEvent = options.Class.extend({

    /**
     * @override
     */
    start() {
        const eventObject = this._getEventObject();
        this.modelName = eventObject.model;
        this.eventId = eventObject.id;
        return this._super(...arguments);
    },

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * @see this.selectClass for parameters
     */
    displaySubmenu(previewMode, widgetValue, params) {
        this._rpc({
            model: this.modelName,
            method: 'toggle_website_menu',
            args: [[this.eventId], widgetValue],
        }).then(() => this.trigger_up('reload_editable', {option_selector: this.data.selector}));
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    async _computeWidgetState(methodName, params) {
        switch (methodName) {
            case 'displaySubmenu': {
                const data = await this._rpc({
                    model: this.modelName,
                    method: 'read',
                    args: [
                        [this.eventId],
                        ['website_menu'],
                    ],
                });
                return data[0]['website_menu'];
            }
        }
        return this._super(...arguments);
    },
    /**
     * @private
     */
    _getEventObject() {
        const repr = this.ownerDocument.documentElement.dataset.mainObject;
        const m = repr.match(/(.+)\((\d+),(.*)\)/);
        return {
            model: m[1],
            id: m[2] | 0,
        };
    },
});
