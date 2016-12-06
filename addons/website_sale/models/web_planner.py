# -*- coding: utf-8 -*-
from odoo import api, models


class PlannerWebsiteSale(models.Model):

    _inherit = 'web.planner'

    def _get_planner_application(self):
        planner = super(PlannerWebsiteSale, self)._get_planner_application()
        planner.append(['planner_website_sale', 'eCommerce Planner'])
        return planner

    def _prepare_planner_website_sale_data(self):
        values = {
            'company_id': self.env.user.company_id,
            'is_coa_installed': bool(self.env['account.account'].search_count([])),
        }
        return values