# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import json
import werkzeug

from odoo import http
from odoo.exceptions import AccessError
from odoo.http import request
from odoo.tools import ustr

from .helpers import HomeStaticTemplateHelpers, get_files

CONTENT_MAXAGE = http.STATIC_CACHE_LONG  # menus, translations, static qweb


class WowlClient(http.Controller):
    @http.route('/wowl', type='http', auth="none")
    def wowl(self, **kw):
        if not request.session.uid:
            return werkzeug.utils.redirect('/web/login', 303)
        if kw.get('redirect'):
            return werkzeug.utils.redirect(kw.get('redirect'), 303)

        request.uid = request.session.uid
        try:
            # LPE Fixme: this cannot be ORM cached (class outside ORM realm) but we could impl
            # a cache if necessary (just like load_menus)
            qweb_checksum = HomeStaticTemplateHelpers.get_qweb_templates_checksum(addons=[], debug=request.session.debug)
            session_info = request.env['ir.http'].session_info()
            session_info['qweb'] = qweb_checksum
            context = {
                "session_info": session_info,
                "scssFiles": get_files('style'),
            }
            response = request.render('wowl.root', qcontext=context)
            response.headers['X-Frame-Options'] = 'DENY'
            return response
        except AccessError:
            return werkzeug.utils.redirect('/web/login?error=access')

    @http.route('/wowl/load_menus/<string:unique>', type='http', auth='user', methods=['GET'])
    def load_menus(self, unique):
        """
        Loads the menus for the webclient
        Method ir.ui.menu.load_menus is ORM cached, and has been done at the first /web request
        :param unique: this parameters is not used, but mandatory: it is used by the HTTP stack to make a unique request
        :return: the menus (including the images in Base64)
        """
        menus = request.env["ir.ui.menu"].load_menus_flat(request.session.debug)
        body = json.dumps(menus, default=ustr)
        response = request.make_response(body, [
            # this method must specify a content-type application/json instead of using the default text/html set because
            # the type of the route is set to HTTP, but the rpc is made with a get and expects JSON
            ('Content-Type', 'application/json'),
            ('Cache-Control', 'public, max-age=' + str(CONTENT_MAXAGE)),
        ])
        return response

    @http.route('/wowl/templates/<string:unique>', type='http', auth="none", cors="*")
    def templates(self, unique, mods=None, db=None):
        content = HomeStaticTemplateHelpers.get_qweb_templates(mods, db, debug=request.session.debug)
        return request.make_response(content, [
            ('Content-Type', 'text/xml'),
            ('Cache-Control', 'public, max-age=' + str(CONTENT_MAXAGE))
        ])

    @http.route('/wowl/tests', type='http', auth="user")
    def test_suite(self, **kw):
        return request.render('wowl.qunit_suite')
