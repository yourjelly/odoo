# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import odoo

def _fill_grids_mapping_for_hu(self, dict_to_fill):
    self.env.cr.execute("""
        select id, name
        from financial_report_lines_v12_bckp
        where xmlid like 'financial_report_line_hu%'
        and domain is not null;
    """)
    dict_to_fill.update(dict(self.env.cr.fetchall()))
