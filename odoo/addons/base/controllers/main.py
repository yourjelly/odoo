# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import base64

from odoo import http
from odoo.http import request


class ReportPreview(http.Controller):

    @http.route('/report_layout_preview', auth="user")
    def report_layout_preview(self, **post):
        self.create_layout_scss(post)
        return request.render('web.report_layout_preview_report', {
            'report_preview_layout': post.get('report_layout'),
            'report_header': post.get('report_header'),
            'report_footer': post.get('report_footer'),
            'company_logo': post.get('logo_url')})

    def create_layout_scss(self, vals):
        IrAttachment = request.env["ir.attachment"]
        report_scss_url = "/web/static/src/scss/custom_%s.scss" % vals.get('company_id')
        report_customization = IrAttachment.search([('url', '=', report_scss_url)])
        scss_content = '$o-brand-primary: %s;$o-brand-odoo: %s; $o_font-family: %s;' % (vals.get('primary_color'), vals.get('secondary_color'), vals.get('font'))
        content = base64.b64encode((scss_content or "\n").encode("utf-8"))
        if report_customization:
            report_customization.datas = content
        else:
            new_attach = {
                'name': report_scss_url,
                'type': "binary",
                'mimetype': "text/scss",
                'datas': content,
                'datas_fname': report_scss_url.split("/")[-1],
                'url': report_scss_url,
            }
            IrAttachment.create(new_attach)
        request.env["ir.qweb"].clear_caches()
