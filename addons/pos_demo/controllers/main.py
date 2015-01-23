# -*- coding: utf-8 -*-
import logging
import werkzeug.utils

from openerp import http
from openerp.http import request
from openerp.addons.web.controllers.main import login_redirect

_logger = logging.getLogger(__name__)


class DemoController(http.Controller):

    @http.route('/pos/demo', type='http', auth='none')
    def a(self, debug=False, **k):
        return request.render('pos_demo.index')
