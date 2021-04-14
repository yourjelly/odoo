/** @odoo-module **/

import { qweb } from 'web.core';
import fieldRegistry from 'web.field_registry';
import { FieldMany2One } from 'web.relational_fields';

/**
 * options :
 * `color_field` : The field that must be use to color the bubble. It must be in the view. (from 0 to 11). Default : grey.
 */
export const StatusWithColor = FieldMany2One.extend({
    _template: 'project.statusWithColor',

    init: function () {
        this._super.apply(this, arguments);
        this.color = this.recordData[this.nodeOptions.color_field];
    },

    /**
     * @override
     */
    _renderReadonly() {
        this._super.apply(this, arguments);
        if (this.value) {
            this.$el.prepend(qweb.render(this._template, {
                color: this.color,
            }));
        }
    },
});

fieldRegistry.add('status_with_color', StatusWithColor);
