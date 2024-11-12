# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class AccountAutomaticEntryWizard(models.TransientModel):
    _inherit = 'account.automatic.entry.wizard'

    def _get_move_line_dict_vals_change_period(self, aml, date):
        res = super()._get_move_line_dict_vals_change_period(aml, date)
        if aml.vehicle_id:
            for move_line_data in res:
                if move_line_data[2]['account_id'] == aml.account_id.id:
                    move_line_data[2]['vehicle_id'] = aml.vehicle_id.id
        return res
