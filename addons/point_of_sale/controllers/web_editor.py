# -*- coding: utf-8 -*-

from openerp import http
from openerp.http import request
from openerp.addons.web_editor.controllers.main import Web_Editor


class Web_Editor(Web_Editor):

    # @http.route(["/website_mass_mailing/field/popup_content"], type='http', auth="user")
    # def mass_mailing_FieldTextHtmlPopupTemplate(self, model=None, res_id=None, field=None, callback=None, **kwargs):
    #     kwargs['snippets'] = '/website/snippets'
    #     kwargs['template'] = 'mass_mailing.FieldTextHtmlPopupContent'
    #     return self.FieldTextHtml(model, res_id, field, callback, **kwargs)

    @http.route('/point_of_sale/field/screen_template', type='http', auth="user")
    def point_of_sale_FieldTextHtmlEmailTemplate(self, model=None, res_id=None, field=None, callback=None, **kwargs):
        kwargs['snippets'] = '/point_of_sale/snippets'
        kwargs['template'] = 'point_of_sale.FieldTextHtmlInline'
        return self.FieldTextHtmlInline(model, res_id, field, callback, **kwargs)

    @http.route(['/point_of_sale/snippets'], type='json', auth="user", website=True)
    def point_of_sale_snippets(self):
        values = {'company_id': request.env['res.users'].browse(request.uid).company_id}
        return request.registry["ir.ui.view"].render(request.cr, request.uid, 'point_of_sale.screen_snippets', values, context=request.context)
