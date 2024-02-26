# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class PublicKeyCredential(models.Model):
    _name = 'public.key.credential'
    _description = 'Public Key'

    user_id = fields.Many2one(
        comodel_name='res.users',
        index='btree_not_null'
    )
    key = fields.Char(string="Credential ID", index=True)
    auth_attachment = fields.Char()
    type = fields.Selection(selection=[
            ('public-key', 'Public Key'),
        ],
    )
    public_key = fields.Char(index=True)
    # data = fields.Binary()
    # attestation = fields.Binary()
    # authenticator_data = fields.Binary()
    # backup_eligibility = fields.Boolean()
    # backup_state = fields.Boolean()
    # transports = fields.Char()

