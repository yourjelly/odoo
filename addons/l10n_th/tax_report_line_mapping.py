# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import odoo

def _fill_grids_mapping_for_th(self, dict_to_fill):
    self.env.cr.execute("""
        select id, SPLIT_PART(name,' - ',1) as name
        from financial_report_lines_v12_bckp
        where code like 'THTAX%'
        and domain is not null;
    """)
    dict_to_fill.update(dict(self.env.cr.fetchall()))
