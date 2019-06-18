# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import odoo

def _fill_grids_mapping_for_au(self, dict_to_fill):
    self.env.cr.execute("""
        update financial_report_lines_v12_bckp
        set code = 'GST from General Ledger'
        where xmlid = 'account_financial_report_l10n_au_gstrpt_c_gl';
    """)
    self.env.cr.execute("""
        select id, code
        from financial_report_lines_v12_bckp
        where xmlid like 'account_financial_report_l10n_au_gstrpt%'
        and domain is not null;
    """)
    dict_to_fill.update(dict(self.env.cr.fetchall()))
