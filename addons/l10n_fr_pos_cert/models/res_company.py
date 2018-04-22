# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models, api, fields


class ResCompany(models.Model):
    _inherit = 'res.company'

    l10n_fr_pos_cert_sequence_id = fields.Many2one('ir.sequence')

    @api.postupdate('l10n_fr_pos_cert_sequence_id')
    def _postupdate_l10n_fr_pos_cert_sequence_id(self):
        #when creating a new french company, create the securisation sequence as well
        #if country changed to fr, create the securisation sequence
        for company in self:
            if company._is_accounting_unalterable():
                company._create_secure_sequence(['l10n_fr_pos_cert_sequence_id'])      
