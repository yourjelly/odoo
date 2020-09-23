# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import http
from odoo.http import request


class WowlClient(http.Controller):
    @http.route('/wowl', type='http', auth="none")
    def root(self):
        return request.render('wowl.root')
