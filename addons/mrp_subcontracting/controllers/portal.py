# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import conf, http
from odoo.http import request
from odoo.addons.portal.controllers import portal
from odoo.addons.web.controllers.main import HomeStaticTemplateHelpers


class CustomerPortal(portal.CustomerPortal):

    @http.route(['/my/productions', '/my/productions/page/<int:page>'], type='http', auth="user", website=True)
    def portal_my_productions(self, page=1, date_begin=None, date_end=None, sortby=None, **kw):
        partner = request.env.user.partner_id
        domain = [('subcontractor_id', '=', partner.id)]
        productions = request.env['mrp.production'].search(domain)
        values = {
            'productions': productions
        }
        return http.request.render("mrp_subcontracting.portal_my_productions", values)

    @http.route("/my/productions/<int:production_id>", type="http", auth="user", methods=['GET'])
    def render_project_backend_view(self, production_id):
        production = request.env['mrp.production'].sudo().browse(production_id)
        if not production.exists():
            return request.not_found()
        session_info = request.env['ir.http'].session_info()
        user_context = request.session.get_context() if request.session.uid else {}
        mods = conf.server_wide_modules or []
        qweb_checksum = HomeStaticTemplateHelpers.get_qweb_templates_checksum(debug=request.session.debug, bundle="mrp_subcontracting.assets_qweb")
        lang = user_context.get("lang")
        translation_hash = request.env['ir.translation'].get_web_translations_hash(mods, lang)
        cache_hashes = {
            "qweb": qweb_checksum,
            "translations": translation_hash,
        }
        production_company = production.company_id
        session_info.update(cache_hashes=cache_hashes, action_name='mrp_subcontracting.subcontracting_portal_view_production_action', production_id=production.id, user_companies={
            'current_company': production_company.id,
            'allowed_companies': {
                production_company.id: {
                    'id': production_company.id,
                    'name': production_company.name,
                },
            },
        })

        return request.render(
            'mrp_subcontracting.subcontracting_portal',
            {'session_info': session_info},
        )
