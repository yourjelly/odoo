# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import odoo

def _fill_grids_mapping_for_ma(self, dict_to_fill):
    """old tax line use domain and sum formula so split line in V13 so here replace with domain value string"""

    self.env.cr.execute("""update financial_report_lines_v12_bckp set name='Achats à l''importation (10%) (HT)' where xmlid = 'account_financial_report_l10n_ma_line_102';
        update financial_report_lines_v12_bckp set name='Achats à l''importation (10%) (TVA)' where xmlid = 'account_financial_report_l10n_ma_line_117';
        """)
    self.env.cr.execute("""
        select id, name
        from financial_report_lines_v12_bckp
        where xmlid like 'account_financial_report_l10n_ma%'
        and domain is not null;
    """)

    for id, name in self.env.cr.fetchall():
        """Update tag name in v13 so replace with new update string"""
        if name.find('-Achat') >= 0:
            name = name.replace('-Achat', 'Achat')
        if name.find('2-IMMOBILISATIONS') >= 0:
            name = name.replace('2-IMMOBILISATIONS', 'Immobilisations')
        dict_to_fill.update(dict([(id, name)]))
