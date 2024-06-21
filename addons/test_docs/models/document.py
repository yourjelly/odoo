# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import uuid

from odoo import api, fields, models, _
from odoo.tools import email_normalize


class Document(models.Model):
    """ A document """
    _description = "Document"
    _name = "document.document"
    _inherit = [
        "mail.thread",
        "mail.activity.mixin",
    ]

    name = fields.Char()
    uuid = fields.Char(default=lambda x: uuid.uuid4().hex)
    access = fields.Selection(
        [
            ('internal', 'Internal'),
            ('uuid', 'UUID'),
        ],
        required=True
    )
