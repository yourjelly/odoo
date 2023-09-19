# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, Command

from odoo.addons.account.models.chart_template import template


class AccountChartTemplate(models.AbstractModel):
    _inherit = ('account.chart.template')

    @template('es_common', model='product.product')
    def _get_product(self):
        print({
            'l10n_es.product_dua_valuation_4': {'supplier_taxes_id': [Command.link('account_tax_template_p_iva4_ibc_group')]},
            'l10n_es.product_dua_valuation_10': {'supplier_taxes_id': [Command.link('account_tax_template_p_iva10_ibc_group')]},
            'l10n_es.product_dua_valuation_21': {'supplier_taxes_id': [Command.link('account_tax_template_p_iva21_ibc_group')]},
        })
        return {
            'l10n_es.product_dua_valuation_4': {'supplier_taxes_id': [Command.clear(), Command.set(['account_tax_template_p_iva4_ibc_group'])]},
            'l10n_es.product_dua_valuation_10': {'supplier_taxes_id': [Command.set(['account_tax_template_p_iva10_ibc_group'])]},
            'l10n_es.product_dua_valuation_21': {'supplier_taxes_id': [Command.link('account_tax_template_p_iva21_ibc_group')]},
        }
