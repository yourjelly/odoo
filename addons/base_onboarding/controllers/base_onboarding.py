# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, http
from odoo.http import request


class OnboardingController(http.Controller):
    @staticmethod
    def get_onboarding_if_applicable(onboarding_route_name):
        """ Return the onboarding record to display if the user is allowed and
        the onboarding is not yet closed.

        :return: Onboarding record or False
        :rtype: Onboarding
        """

        if not request.env.is_admin():
            return False

        onboarding = request.env['base.onboarding'].search(
            ['route_name', '=', onboarding_route_name])

        return onboarding if not onboarding.with_company(request.env.company).is_done else False

    @http.route('/onboarding/<string:onboarding_route_name>', auth='user', type='json')
    def get_onboarding_data(self, onboarding_route_name):
        onboarding = self.get_onboarding_if_applicable(onboarding_route_name)
        if not onboarding:
            return {}

        return {
            'html': request.env['ir.qweb']._render(
                'base_onboarding.onboarding_panel',
                onboarding.with_company(request.env.company).panel_properties)
        }
