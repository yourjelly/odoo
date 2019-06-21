# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import odoo

def _fill_grids_mapping_for_hr(self, dict_to_fill):
    """same tag_name so I think it's complicated to find right one from this dict_to_fill
        For this tag_names
        II.1 Izdani računi po stopi 10%
        II.3 Izdani računi po stopi 25%
        III.1. Pretporez 10%
        III.4. Plaćeni PP pri uvozu
        III.5. Plaćeni PP na ino usluge 10%
        III.7. Plaćeni PP na ino usluge 25%
        II.1 Izdani računi po stopi 10%
        II.3 Izdani računi po stopi 25%
        III.1. Pretporez 10%
        III.4. Plaćeni PP pri uvozu
        III.5. Plaćeni PP na ino usluge 10%
        III.7. Plaćeni PP na ino usluge 25%

        you can find same tag_name line one of is used for tax amount and another one is used for the base amount
    """
    self.env.cr.execute("""update financial_report_lines_v12_bckp set name = replace(name,' bis', ' (30%)')
        where xmlid like 'financial_report_l10n_hr%' and name ilike '% bis';
        update financial_report_lines_v12_bckp set name = replace(name,' ter', ' (70%)')
            where xmlid like 'financial_report_l10n_hr%' and name ilike '% ter';""")

    self.env.cr.execute("""
        select id, name
        from financial_report_lines_v12_bckp
        where xmlid like 'financial_report_l10n_hr%'
        and domain is not null;
    """)
    dict_to_fill.update(dict(self.env.cr.fetchall()))
