# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import Command, models, fields


class MailActivity(models.Model):
    _inherit = "mail.activity"

    account_peppol_invoice_response_id = fields.Many2one('account_peppol.invoice_response')

