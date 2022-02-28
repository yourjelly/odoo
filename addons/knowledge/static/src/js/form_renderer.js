/** @odoo-module **/

import FormRenderer from 'web.FormRenderer';
import core from 'web.core';

FormRenderer.include({
    _render: async function () {
        await this._super(...arguments);
        core.bus.once('DOM_updated', this, function () {
            for (let record = this.call('knowledgeService', 'popToValidateWithHtmlField');
                record; record = this.call('knowledgeService', 'popToValidateWithHtmlField')) {
                for (let fieldName = record.fieldNames.shift(); fieldName; fieldName = record.fieldNames.shift()) {
                    if (this._checkAvailability(fieldName.name)) {
                        record.fieldNames = [fieldName];
                        record.withHtmlField = true;
                        break;
                    }
                }
                if (record.withHtmlField) {
                    this.call('knowledgeService', 'addRecord', record);
                    break;
                }
            }
        });
    },
    _checkAvailability: function (name) {
        const selector = `.oe_form_field_html[name="${name}"]`;
        const $sel = $(selector);
        for (let i = 0; i < $sel.length; i++) {
            if ($sel.eq(i).is(':visible:hasVisibility')) {
                return true;
            } else if ($sel[i].closest('.o_invisible_modifier')) {
                continue;
            } else {
                let pane = $sel[i].closest('.tab-pane:not(.active)');
                if (pane) {
                    let $paneSwitch = $(`[data-toggle="tab"][href*="${pane.id}"]`);
                    if ($paneSwitch.is(':visible:hasVisibility')) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
});
