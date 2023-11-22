/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { AbstractSpreadsheetAction } from '@documents_spreadsheet/actions/abstract_spreadsheet_action';

patch(AbstractSpreadsheetAction.prototype, 'spreadsheet_email/static/src/js/email_action.js',{
    setup() {
        this._super(...arguments);
    },

    /**
     * Create a copy of the given spreadsheet and display it
     */
    async _onEmail(ev) {
        this._openMail(ev.detail.files);
    },

    _openMail(body) {
        const msg = "<p>this is the draft message</p></br>"
        this.actionService.doAction(
            {
                type: 'ir.actions.act_window',
                res_model: 'mail.compose.message',
                views: [[false, 'form']],
                target: 'new',
                context: {
                    default_body: msg + body,
                },
            }
        );
    }
});