# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class EventType(models.Model):
    _inherit = "event.type"

    website_community = fields.Boolean(
        "Website Community", help="Display community tab on website"
    )
