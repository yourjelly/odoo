# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

PEPPOL_INVOICE_RESPONSE_TYPES = [
    ('peppol_invoice_response', 'Peppol Invoice Response'),
    ('peppol_invoice_response_ack', 'Peppol Invoice Response'),
    ('peppol_invoice_response_confirm', 'Peppol Invoice Response'),
    ('peppol_invoice_response_cancel', 'Peppol Invoice Response'),
]


class MailActivityType(models.Model):

    _inherit = 'mail.activity.type'
    category = fields.Selection(selection_add=PEPPOL_INVOICE_RESPONSE_TYPES)
