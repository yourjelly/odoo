# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models


class ResUsers(models.Model):
    _inherit = 'res.users'

    def _has_unsplash_key_rights(self, mode='write'):
        self.ensure_one()
        assert mode in ('read', 'write')

        # Some modules like website/mass_mailing hav no dependency to
        # web_unsplash, we cannot warranty the order of the execution of the
        # overwrite that would be done in those modules, as in 5ef8300.
        # T avoid to create a new module bridge for each of those modules, with
        # a lot of code, we prefer to make a check here for those cases.

        if self.has_group('base.group_erp_manager'):
            return True

        if mode == 'write':
            return self.has_group('website.group_website_designer')

        return self.user_has_groups(','.join([
            'website.group_website_publisher',
            'mass_mailing.group_mass_mailing_user',
            # 'project.group_project_user',  # etc..
        ]))
