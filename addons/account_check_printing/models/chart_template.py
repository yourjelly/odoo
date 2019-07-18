# -*- coding: utf-8 -*-

from odoo import api, models
from odoo.http import request


class AccountChartTemplate(models.Model):
    _inherit = 'account.chart.template'

    def _create_bank_journals(self, company, acc_template_ref):
        '''
        When system automatically creates journals of bank and cash type when CoA is being installed
        do not enable the `Check` payment method on bank journals of type `Cash`.

        '''
        bank_journals = super(AccountChartTemplate, self)._create_bank_journals(company, acc_template_ref)
        payment_method_check = self.env.ref('account_check_printing.account_payment_method_check')
        bank_journals.filtered(lambda journal: journal.type == 'cash').write({
            'outbound_payment_method_ids': [(3, payment_method_check.id)]
        })
        return bank_journals

    def try_loading_for_current_company(self):
        self.ensure_one()
        res = super().try_loading_for_current_company()

        chart_template_xmlid = self.get_external_id().get(self.id)
        chart_template_country_code = chart_template_xmlid[5:7]

        module_xmlid = 'l10n_%s_check_printing' % chart_template_country_code

        current_country_report_actions = self.env['ir.actions.report'].search([
            ('model', '=', 'account.payment'),
            ('xml_id', 'ilike', module_xmlid)
        ])

        if not current_country_report_actions:
            return res

        if request and hasattr(request, 'allowed_company_ids'):
            company = self.env['res.company'].browse(request.allowed_company_ids[0])
        else:
            company = self.env.company

        company.account_check_printing_report_action_id = current_country_report_actions[0]

        return res
