# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, models
from odoo.http import request


class IrHttp(models.AbstractModel):
    _inherit = 'ir.http'

    @classmethod
    def _pre_dispatch(cls, rule, args):
        super()._pre_dispatch(rule, args)
        affiliate_id = request.httprequest.args.get('affiliate_id')
        if affiliate_id:
            request.session['affiliate_id'] = int(affiliate_id)

    @api.model
    def get_frontend_session_info(self):
        session_info = super().get_frontend_session_info()
        cart_action = request.website.add_to_cart_action
        session_info['add2cart_redirect'] = '1' if cart_action == 'stay' else '0' if cart_action == 'go_to_cart' else '2'
        return session_info
