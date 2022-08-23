# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import models, fields


class ResCompany(models.Model):
    _inherit = 'res.company'

    l10n_ke_device_sender_id = fields.Char(string="Device Sender ID (or GUUID)")
    l10n_ke_device_proxy_url = fields.Char(default="http://localhost:8069", string="Proxy URL")
    l10n_ke_device_url = fields.Char(string="Device URL")
    l10n_ke_access_token = fields.Char(string="Access Token")
