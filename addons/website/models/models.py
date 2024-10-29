# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class Base(models.AbstractModel):
    _inherit = ["base"]

    def _can_elevate_access(self, access_token, field):
        return super()._can_elevate_access(access_token, field) or (
            "website_published" in self._fields
            and field in self._fields
            and not self._fields[field].groups
            and self.sudo().website_published
        )
