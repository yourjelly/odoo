# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models
from odoo.http import request


class Lang(models.Model):
    _inherit = "res.lang"

    @api.model
    def get_available(self):
        langs = super().get_available()
        if not request or not request.is_frontend:
            return langs
        # Only return the active ones in this case
        return [lang for lang in langs if lang[3]]
