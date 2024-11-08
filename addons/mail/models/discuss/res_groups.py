# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.addons.mail.tools.discuss import Store


class ResGroups(models.Model):
    _inherit = ["res.groups"]

    def write(self, vals):
        res = super().write(vals)
        if vals.get("users"):
            self.env["discuss.channel"].search([("group_ids", "in", self._ids)])._subscribe_users_automatically()
        return res

    def _to_store(self, store: Store, /, *, fields=None):
        if fields is None:
            fields = ["full_name"]
        store.add("res.groups", self._read_format(fields, load=False))
