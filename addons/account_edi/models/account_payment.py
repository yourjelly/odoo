# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _


class AccountPayment(models.Model):
    _inherit = 'account.payment'

    edi_document_ids = fields.One2many(related='move_id.edi_document_ids')
    edi_state = fields.Selection(related='move_id.edi_state')
    edi_error_amount = fields.Integer(related='move_id.edi_error_amount')
