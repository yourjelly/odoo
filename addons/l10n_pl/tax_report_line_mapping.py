# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import odoo
from odoo.exceptions import UserError


def _fill_grids_mapping_for_pl(self, dict_to_fill):
    self.env.cr.execute("""
        select name, id
            from financial_report_lines_v12_bckp rlv12
            where xmlid like 'account_financial_report_pl_%';
    """)
    nltax_lines_map = {entry['name']: entry for entry in self.env.cr.dictfetchall()}
    poland_id = self.env['ir.model.data'].xmlid_to_res_id('base.pl')
    v13_tax_report_lines = self.env['account.tax.report.line'].search([('country_id', '=', poland_id), ('tag_name', '!=', None)])
    # For report lines with childrens that are merged in a single line in v13,
    for v13_line in v13_tax_report_lines:
        v12_line_data = nltax_lines_map.get(v13_line.name)
        if v12_line_data:
            dict_to_fill.update({v12_line_data['id']: v13_line.tag_name})
        else:
            raise UserError("No V12 report line found with name " + v13_line.name)
