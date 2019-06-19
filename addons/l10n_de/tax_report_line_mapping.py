# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import odoo

def _fill_grids_mapping_for_de(self, dict_to_fill):
    germany_id = self.env['ir.model.data'].xmlid_to_res_id('base.de')
    v13_tax_report_line_tag_names = self.env['account.tax.report.line'].search([('country_id', '=', germany_id), ('tag_name', '!=', None)]).mapped('tag_name')
    self.env.cr.execute("""
        select id, SPLIT_PART(name,'.',1) as name, xmlid
        from financial_report_lines_v12_bckp
        where xmlid like 'financial_report_line_de%'
        and domain is not null;
    """)
    for v12_line in self.env.cr.dictfetchall():
        name = v12_line['name'] + (v12_line['xmlid'].find('_base') > 0 and '_BASE' or '_TAX')
        if name not in v13_tax_report_line_tag_names:
            name = v12_line['name']
        dict_to_fill.update({v12_line['id']: name})
