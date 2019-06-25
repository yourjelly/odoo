# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import odoo

def _fill_grids_mapping_for_ro(self, dict_to_fill):
    """Same name of tag name so find multi tax report line per tag_name so check it, how to deal with it."""
    self.env.cr.execute("""
        select id, name
        from financial_report_lines_v12_bckp
        where xmlid like 'account_financial_report_ro%'
        and domain is not null;
    """)
    dict_to_fill.update(dict(self.env.cr.fetchall()))
