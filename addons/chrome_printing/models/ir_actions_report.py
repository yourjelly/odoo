# Part of Odoo. See LICENSE file for full copyright and licensing details.
from contextlib import closing


import base64
import tempfile
import time
import os


from odoo import api, fields, models
from odoo.tools.config import config


from .devtools_api import browser


HOST = "http://localhost:8069"


class IrActionsReport(models.Model):
    _inherit = 'ir.actions.report'

    def _render_qweb_pdf(self, res_ids=None, data=None):
        if not data:
            data = {}

        data.setdefault('report_type', 'pdf')
        sid = data.pop('_chrome_sid', None)
        self_sudo = self.sudo()
        report_name = self_sudo.report_name
        context = dict(self.env.context)
        if not config['test_enable']:
            context['commit_assetbundle'] = True
        context['debug'] = False
        # html = self_sudo.with_context(context)._render_qweb_html(res_ids, data=data)[0]
        # bodies, html_ids, header, footer, specific_paperformat_args = self_sudo\
            # .with_context(context)\
            # ._prepare_html(html)

        browser.Network.setCookie('session_id', sid, 'localhost', '/')
        browser.Page.navigate(f"{HOST}/report/html/{report_name}/{res_ids[0]}")
        browser.Page.enable()
        promise = browser.Page.printToPDF()
        result = promise.resolve()
        return base64.b64decode(result), 'pdf'

    @api.model
    def _print_chrome(self, file_path):
        pdf_report_fd, pdf_report_path = tempfile.mkstemp(suffix='.pdf', prefix='report.tmp')
        os.close(pdf_report_fd)
        IrConfig = self.env['ir.config_parameter'].sudo()
        base_url = IrConfig.get_param('report.url') or IrConfig.get_param('web.base.url')

        try:
            browser.Page.navigate(f"file://{file_path}")
            browser.Page.printToPDF()
            results = browser.wait()
            return results[-1]
        except:
            raise

    def _render_qweb_html(self, docids, data=None):
        sid = data and data.pop('_chrome_sid', None)
        return super()._render_qweb_html(docids, data=data)

    def _render_qweb_text(self, docids, data=None):
        sid = data and data.pop('_chrome_sid', None)
        return super()._render_qweb_text(docids, data=data)
