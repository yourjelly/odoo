# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.tools import email_normalize


class Container(models.Model):
    """ Container """
    _description = "Container"
    _name = "container.container"
    _inherit = [
        "mail.thread",
        "mail.activity.mixin",
    ]

    name = fields.Char()
    access = fields.Selection([("internal", "Internal"), ("all", "All")], required=True)
    document_id = fields.Many2oneUUID(
        "document.document", uuid_field="document_uuid"
    )
    document_uuid = fields.Char(related="document_id.uuid")
