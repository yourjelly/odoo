import odoo

def _fill_grids_mapping_for_at(self, dict_to_fill):
    """same tag_name so I think it's complicated to find right one from this dict_to_fill
        check this
        "zum Steuersatz von 20 %"
            tax_report_bemess_vorst_rechnungen_20               tag_at_27
            tax_report_ust_steuern_lief_steu_20                 tag_at_12
            tax_report_ust_steuern_innergemeinschaft_steu_20    tag_at_06

        "zum Steuersatz von 10 %"
            tax_report_bemess_vorst_rechnungen_10               tag_at_26
            tax_report_ust_steuern_innergemeinschaft_steu_10    tag_at_08
    """
    code_prefix = 'ATT'
    self.env.cr.execute("""
        select id, name
        from financial_report_lines_v12_bckp
        where code like '%(prefix)s%%'
        and domain is not null;
    """ % {'prefix': code_prefix})

    dict_to_fill.update(dict(self.env.cr.fetchall()))
