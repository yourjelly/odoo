# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging

from odoo import models
from odoo.tools import populate

_logger = logging.getLogger(__name__)


class Users(models.Model):
    _inherit = "res.users"

    _populate_sizes = {"small": 10, "medium": 2000, "large": 10000}

    _populate_dependencies = ["res.partner"]

    def _populate_factories(self):
        partner_ids = self.env.registry.populated_models["res.partner"]

        def partner_id_callable(values=None, counter=0, complete=False, random=None, **kwargs):
            partner_id = random.choice(partner_ids)
            partner_ids.remove(partner_id)
            return partner_id

        return [
            ("partner_id", populate.compute(partner_id_callable)),
            ("login", populate.constant("user_login_{counter}")),
            #  ("active", populate.cartesian([True, False], [0.9, 0.1])),  # it petes
            ("state", populate.constant("active_{counter}")),  # can be active or new see auth_signup inherited model. Avoid trying to send mail for now
        ]

    def _populate(self, scale):
        self = self.with_context(no_reset_password=True)  # avoid sending reset password email
        return super(Users, self)._populate(scale)
