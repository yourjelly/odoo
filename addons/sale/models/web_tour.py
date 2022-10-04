# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class WebTour(models.Model):
    _inherit = 'web_tour.tour'

    @api.model
    def _get_tour_filters(self):
        """TODO docstring

        :rtype: dict
        """
        return {
            'company_setup': self.env.user.company.base_onboarding_company_state != 'not_done',
        }
