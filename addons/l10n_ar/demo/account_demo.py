# -*- coding: utf-8 -*-
import logging

from odoo import api, models

_logger = logging.getLogger(__name__)


class AccountChartTemplate(models.AbstractModel):
    _inherit = "account.chart.template"

    @api.model
    def _get_demo_data(self, company=None):
        company = company or self.env.company
        ref = self.env.ref

        # Do not load generic demo data on these companies
        ar_demo_companies = (
            ref('l10n_ar.company_mono', raise_if_not_found=False),
            ref('l10n_ar.company_exento', raise_if_not_found=False),
            ref('l10n_ar.company_ri', raise_if_not_found=False),
        )
        if company in ar_demo_companies:
            return []

        yield ('res.partner', {
            'base.res_partner_12': {
                'l10n_ar_afip_responsibility_type_id': 'l10n_ar.res_IVARI',
            },
            'base.res_partner_2': {
                'l10n_ar_afip_responsibility_type_id': 'l10n_ar.res_IVARI',
            },
        })
        for model, data in super()._get_demo_data(company):
            yield model, data

    @api.model
    def _get_demo_data_move(self, company=None):
        company = company or self.env.company
        cid = company.id
        model, data = super()._get_demo_data_move(company)
        if company.account_fiscal_country_id.code == "AR":
            data[f'{cid}_demo_invoice_5']['l10n_latam_document_number'] = '1-1'
            data[f'{cid}_demo_invoice_equipment_purchase']['l10n_latam_document_number'] = '1-2'
        return model, data
