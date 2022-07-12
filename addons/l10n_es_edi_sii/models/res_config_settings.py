# -*- coding: utf-8 -*-

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    l10n_es_edi_certificate_ids = fields.One2many(related='company_id.l10n_es_edi_certificate_ids', related_inverse=True)
    l10n_es_edi_tax_agency = fields.Selection(related='company_id.l10n_es_edi_tax_agency', related_inverse=True)
    l10n_es_edi_test_env = fields.Boolean(related='company_id.l10n_es_edi_test_env', related_inverse=True)
