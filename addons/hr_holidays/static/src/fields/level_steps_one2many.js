/** @odoo-module */

import { patch } from '@web/core/utils/patch';
import { useService } from "@web/core/utils/hooks";
import { X2ManyFieldDialog } from "@web/views/fields/relational_utils";

patch(X2ManyFieldDialog.prototype, 'level_steps_one2many_prototype', {
    /**
     *  Action service is not available in X2ManyFieldDialog so i added here
     *
     * @override
     */
    setup() {
        this._super(...arguments);
        this.action = useService("action");
    },

    /**
     * When the save and close action is performed, redirect to the view of emp
     *
     * @override
     * @returns {object} action.
     */
    async save({ saveAndNew }) {
        const res = await this._super(...arguments);
        if (!res || this.record.resModel !== 'hr.leave.accrual.level') {
            return res
        }
        return this.action.doAction({
            name: this.env._t("Accrual Plan's Employees"),
            res_model: 'hr.employee',
            type: 'ir.actions.act_window',
            view_mode: 'kanban,tree',
            views: [[false, 'list'], [false, 'form']],
            target: 'current',
        });
    }
});
