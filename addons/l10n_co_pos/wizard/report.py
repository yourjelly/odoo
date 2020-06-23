# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class PosDetails(models.TransientModel):
    _inherit = 'pos.details.wizard'
    _description = 'Point of Sale Details Report'

    def generate_report(self):
        data = {'date_start': self.start_date, 'date_stop': self.end_date, 'config_ids': self.pos_config_ids.ids}
        if all(code == 'CO' for code in self.pos_config_ids.mapped('company_id.country_id.code')):
            return self.env.ref('point_of_sale.sale_details_report').report_action([], data=data)
        return self.env.ref('point_of_sale.sale_details_report').report_action([], data=data)
