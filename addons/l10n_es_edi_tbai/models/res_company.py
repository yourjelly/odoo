# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

L10N_ES_EDI_TBAI_VERSION = 1.2
L10N_ES_EDI_TBAI_URLS = {
    'invoice_test': {
        'araba': '',
        'bizkaia': '',
        'gipuzkoa': 'https://tbai-prep.egoitza.gipuzkoa.eus/WAS/HACI/HTBRecepcionFacturasWEB/rest/recepcionFacturas/alta'
    },
    'invoice_prod': {
        'araba': '',
        'bizkaia': '',
        'gipuzkoa': 'https://tbai-z.egoitza.gipuzkoa.eus/sarrerak/alta'
    },
    'qr_test': {
        'araba': '',
        'bizkaia': '',
        'gipuzkoa': 'https://tbai.prep.gipuzkoa.eus/qr/'
    },
    'qr_prod': {
        'araba': 'https://ticketbai.araba.eus/TBAI/QRTBAI',
        'bizkaia': 'https://batuz.eus/QRTBAI/',
        'gipuzkoa': 'https://tbai.egoitza.gipuzkoa.eus/qr/'
    },
    'cancel_test': {
        'araba': '',
        'bizkaia': '',
        'gipuzkoa': 'https://tbai-prep.egoitza.gipuzkoa.eus/WAS/HACI/HTBRecepcionFacturasWEB/rest/recepcionFacturas/anulacion'
    },
    'cancel_prod': {
        'araba': '',
        'bizkaia': '',
        'gipuzkoa': 'https://tbai-z.egoitza.gipuzkoa.eus/sarrerak/baja'
    }
}

class ResCompany(models.Model):
    _inherit = 'res.company'

    # === TBAI config ===
    l10n_es_tbai_tax_agency = fields.Selection(
        string="Tax Agency for TBAI",
        selection=[
            ('araba', "Hacienda Foral de Araba"),
            ('bizkaia', "Hacienda Foral de Bizkaia"),
            ('gipuzkoa', "Hacienda Foral de Gipuzkoa")
        ],
        default=False,  # TODO set default based on region
    )

    l10n_es_tbai_test_env = fields.Boolean(
        string="Test Mode",
        help="Use the test environment",
        copy=False
    )

    l10n_es_tbai_url_invoice = fields.Char(
        string="URL for submitting invoices",
        readonly=True,
        compute="_compute_l10n_es_tbai_url_invoice"
    )

    l10n_es_tbai_url_cancel = fields.Char(
        string="URL for canceling invoices",
        readonly=True,
        compute="_compute_l10n_es_tbai_url_cancel"
    )

    l10n_es_tbai_url_qr = fields.Char(
        string="URL for generating QR code",
        readonly=True,
        compute="_compute_l10n_es_tbai_url_qr"
    )

    # === CERTIFICATES ===
    l10n_es_tbai_certificate_id = fields.Many2one(
        string="Certificate (ES-TicketBai)",
        store=True,
        readonly=False,
        comodel_name='l10n_es_edi_tbai.certificate',
        compute="_compute_l10n_es_tbai_certificate",
    )
    l10n_es_tbai_certificate_ids = fields.One2many(
        comodel_name='l10n_es_edi_tbai.certificate',
        inverse_name='company_id',
    )

    def _compute_l10n_es_tbai_url(self, prefix):
        if self.country_code == 'ES':
            suffix = 'test' if self.l10n_es_tbai_test_env else 'prod'
            return L10N_ES_EDI_TBAI_URLS[prefix + suffix][self.l10n_es_tbai_tax_agency]
        else:
            return False

    @api.depends('country_id', 'l10n_es_tbai_tax_agency', 'l10n_es_tbai_test_env')
    def _compute_l10n_es_tbai_url_invoice(self):
        for company in self:
            company.l10n_es_tbai_url_invoice = self._compute_l10n_es_tbai_url('invoice_')

    @api.depends('country_id', 'l10n_es_tbai_tax_agency', 'l10n_es_tbai_test_env')
    def _compute_l10n_es_tbai_url_cancel(self):
        for company in self:
            company.l10n_es_tbai_url_cancel = self._compute_l10n_es_tbai_url('cancel_')

    @api.depends('country_id', 'l10n_es_tbai_tax_agency', 'l10n_es_tbai_test_env')
    def _compute_l10n_es_tbai_url_qr(self):
        for company in self:
            company.l10n_es_tbai_url_qr = self._compute_l10n_es_tbai_url('qr_')

    @api.depends('country_id', 'l10n_es_tbai_certificate_ids')
    def _compute_l10n_es_tbai_certificate(self):
        for company in self:
            if company.country_code == 'ES':
                company.l10n_es_tbai_certificate_id = self.env['l10n_es_edi_tbai.certificate'].search(
                    [('company_id', '=', company.id)],
                    order='date_end desc',
                    limit=1,
                )
            else:
                company.l10n_es_tbai_certificate_id = False
