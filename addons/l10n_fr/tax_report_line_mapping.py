# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import odoo

def _fill_grids_mapping_for_fr(self, dict_to_fill):
    self.env.cr.execute("""update financial_report_lines_v12_bckp set domain=NULL where xmlid = 'account_financial_report_line_98_fr';
        update financial_report_lines_v12_bckp set name='collectée 5.5%' where xmlid = 'account_financial_report_line_08_fr';""")
    self.env.cr.execute("""
        select sub.id,
            CASE WHEN sub.parent_name = 'Base H.T. TVA collectée' THEN replace(sub.name,'H.T.','collectée')
    			WHEN sub.parent_name = 'TVA collectée' THEN replace(sub.name,'TVA','TVA collectée')

    			WHEN sub.parent_name = 'Base H.T. TVA acquittée' THEN replace(sub.name,'H.T.','acquittée')
    			WHEN sub.parent_name = 'TVA acquittée' THEN replace(sub.name,'TVA','TVA acquittée')

    			WHEN sub.parent_name = 'Base H.T. TVA acquittée pour immobilisations' THEN replace(sub.name,'H.T.','acquittée immo.')
    			WHEN sub.parent_name = 'TVA acquittée pour immobilisations' THEN replace(sub.name,'TVA','TVA acquittée immo.')


    			WHEN sub.parent_name = 'Base H.T. TVA due intracommunautaire' THEN replace(sub.name,'H.T.','due intracom.')
    			WHEN sub.parent_name = 'TVA due intracommunautaire' THEN replace(sub.name,'TVA','TVA due intracom.')


    			WHEN sub.parent_name = 'Base H.T. TVA déductible intracommunautaire' THEN replace(sub.name,'H.T.','déductible intracom.')
    			WHEN sub.parent_name = 'TVA déductible intracommunautaire' THEN replace(sub.name,'TVA','TVA déductible intracom.')

    			ELSE name
    		END as tag_name
        from (select id, name,
            (select name from financial_report_lines_v12_bckp rlv12_parent where rlv12_parent.id = rlv12.parent_id) as parent_name
            from financial_report_lines_v12_bckp rlv12
            where xmlid like '%_fr'
            and domain is not null) as sub
    """)
    dict_to_fill.update(dict(self.env.cr.fetchall()))
