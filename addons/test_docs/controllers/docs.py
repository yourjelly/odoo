# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import werkzeug

from odoo import conf, http, tools, _
from odoo.exceptions import AccessError, ValidationError
from odoo.http import request


class DocsController(http.Controller):

    # ------------------------
    # Article Access Routes
    # ------------------------

    @http.route('/docs/home', type='http', auth='user')
    def access_docs_home(self):
        """ This route will redirect internal users to the backend view of the
        article and the share users to the frontend view instead. """
        if request.env.user._is_internal():
            return self._redirect_to_backend_view(None)
        return self._redirect_to_portal_view(None)

    def _redirect_to_backend_view(self, document):
        return request.redirect("/web#id=%s&model=document.document&action=%s&menu_id=%s" % (
            document.id if document else '',
            request.env.ref("test_docs.document_document_action").id,
            request.env.ref('test_docs.document_document_menu').id
        ))

    def _redirect_to_portal_view(self, article):
        # We build the session information necessary for the web client to load
        session_info = request.env['ir.http'].session_info()
        user_context = dict(request.env.context)
        mods = conf.server_wide_modules or []
        lang = user_context.get("lang")
        cache_hashes = {
            "translations": request.env['ir.http'].get_web_translations_hash(mods, lang),
        }

        session_info.update(
            cache_hashes=cache_hashes,
            user_companies={
                'current_company': request.env.company.id,
                'allowed_companies': {
                    request.env.company.id: {
                        'id': request.env.company.id,
                        'name': request.env.company.name,
                    },
                },
            },
        )

        return request.render(
            'test_docs.docs_portal_view',
            {'session_info': session_info},
        )
