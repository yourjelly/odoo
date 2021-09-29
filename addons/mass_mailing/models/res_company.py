# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.exceptions import AccessError


class ResCompany(models.Model):
    _inherit = "res.company"

    def try_set_social_media_links(self, **kwargs):
        fields = ['social_facebook', 'social_youtube', 'social_linkedin', 'social_linkedin', 'social_instagram']

        try:
            self.env.company.check_access_rights('write')
            self.env.company.check_field_access_rights('write', fields)
            self.env.company.check_access_rule('write')

            link_to_save = {}
            for field in fields:
                if (kwargs.get(field)):
                    link_to_save[field] = kwargs.get(field)

            if link_to_save:
                self.env.company.write(link_to_save)

            return True
        except AccessError:
            return False

    def _get_social_media_links(self):
        self.ensure_one()
        return {
            'social_facebook': self.social_facebook,
            'social_youtube': self.social_youtube,
            'social_linkedin': self.social_linkedin,
            'social_twitter': self.social_twitter,
            'social_instagram': self.social_instagram
        }
