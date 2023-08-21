# Part of Odoo. See LICENSE file for full copyright and licensing details.
from contextlib import closing


import lxml
import os
import tempfile
import logging

from odoo import api, models, tools
from odoo.sql_db import TestCursor
from odoo.tools.config import config
from odoo.addons.base.models.report_paperformat import PAPER_SIZES


from .devtools_api import browser


_logger = logging.getLogger(__name__)

class IrActionsReport(models.Model):
    _inherit = 'ir.actions.report'

    def _render_qweb_pdf(self, res_ids=None, data=None):
        print(' --- rendering using chrome --- ')
        if not data:
            data = {}
        data.setdefault('report_type', 'pdf')

        self_sudo = self.sudo()

        if (tools.config['test_enable'] or tools.config['test_file']) and \
                not self.env.context.get('force_report_rendering'):
            return self._render_qweb_html(res_ids, data=data)

        context = dict(self.env.context)
        if not config['test_enable']:
            context['commit_assetbundle'] = True
        context['debug'] = False

        if isinstance(self.env.cr, TestCursor):
            return self_sudo.with_context(context)._render_qweb_html(res_ids, data=data)[0]

        save_in_attachment = {}
        if res_ids:
            Model = self.env[self_sudo.model]
            record_ids = Model.browse(res_ids)
            to_print_ids = Model
            if self_sudo.attachment:
                for record_id in record_ids:
                    attachment = self_sudo.retrieve_attachment(record_id)
                    if attachment:
                        save_in_attachment[record_id.id] = self_sudo\
                            ._retrieve_stream_from_attachment(attachment)
                    if not self_sudo.attachment_use or not attachment:
                        to_print_ids |= record_id
            else:
                to_print_ids = record_ids
            res_ids = to_print_ids.ids

        if save_in_attachment and not res_ids:
            # TODO: logging
            return self_sudo._post_pdf(save_in_attachment), 'pdf'

        html = self_sudo.with_context(context)._render_qweb_html(res_ids, data=data)[0]
        rendered, html_ids, specific_paperformat_args = self_sudo\
            .with_context(context)\
            ._prepare_html(html)

        # TODO: check if it's still necessary to compare as sets
        if self_sudo.attachment and set(res_ids) != set(html_ids):
            # TODO: use proper exception + message
            raise Exception

        pdf_content = self._print_chrome(
            rendered=rendered,
            landscape=context.get('landscape'),
            specific_paperformat_args=specific_paperformat_args,
            set_viewport_size=context.get('set_viewport_size'),
        )

        if res_ids:
            return self_sudo\
                ._post_pdf(save_in_attachment, pdf_content=pdf_content, res_ids=html_ids), 'pdf'
        return pdf_content, 'pdf'

    @api.model
    def preprocess(self, headers, articles, footers):
        pass

    def _prepare_html(self, html):
        '''Divide and recreate the header/footer html by merging all found in html.
        The bodies are extracted and added to a list. Then, extract the specific_paperformat_args.
        The idea is to put all headers/footers together. Then, we will use a javascript trick
        (see minimal_layout template) to set the right header/footer during the processing of wkhtmltopdf.
        This allows the computation of multiple reports in a single call to wkhtmltopdf.

        :param html: The html rendered by render_qweb_html.
        :type: bodies: list of string representing each one a html body.
        :type header: string representing the html header.
        :type footer: string representing the html footer.
        :type specific_paperformat_args: dictionary of prioritized paperformat values.
        :return: bodies, header, footer, specific_paperformat_args
        '''
        IrConfig = self.env['ir.config_parameter'].sudo()
        base_url = IrConfig.get_param('report.url') or IrConfig.get_param('web.base.url')

        # Return empty dictionary if 'web.minimal_layout' not found.
        layout = self.env.ref('chrome_printing.minimal_layout', False)
        if not layout:
            return {}
        layout = self.env['ir.ui.view'].browse(self.env['ir.ui.view'].get_view_id('chrome_printing.minimal_layout'))

        root = lxml.html.fromstring(html)
        match_klass = "//{}[contains(concat(' ', normalize-space(@class), ' '), ' {} ')]"

        res_ids = []

        main = lxml.etree.Element('main')
        headers = root.xpath(match_klass.format('div', 'header'))
        footers = root.xpath(match_klass.format('div', 'footer'))
        articles = root.xpath(match_klass.format('div', 'article'))

        # TODO: set it up properly, try to avoid multiple loops if possible
        self.preprocess(headers, articles, footers)

        for i, (header, article, footer) in enumerate(zip(headers, articles, footers), start=1):
            main.append(header)
            main.append(article)
            main.append(footer)
            if article.get('data-oe-model') == self.model:
                res_ids.append(int(article.get('data-oe-id', 0)))
            else:
                res_ids.append(None)

        # Get paperformat arguments set in the root html tag. They are prioritized over
        # paperformat-record arguments.
        specific_paperformat_args = {}
        for attribute in root.items():
            if attribute[0].startswith('data-report-'):
                specific_paperformat_args[attribute[0]] = attribute[1]

        rendered = layout._render(dict(subst=False, body=lxml.html.tostring(main), base_url=base_url))
        return rendered, res_ids, specific_paperformat_args

    def _build_chrome_print_args(
        self,
        paperformat_id,
        landscape,
        specific_paperformat_args=None,
        set_viewport_size=False,
    ):
        # TODO: set_viewport_size should be handled by the script that instantiates chrome
        # Chrome limitations: viewport_size, dpi, header-spacing and header-line

        def good2bad(n):
            # all the stored measures are in mm, this function converts mm to inches
            # author's note: the imperial system was a mistake
            return round(n * 0.0393701, 2)

        if landscape is None and specific_paperformat_args and specific_paperformat_args\
                .get('data-report-landscape'):
            landscape = specific_paperformat_args['data-report-landscape']

        args = {'displayHeaderFooter': True}
        if paperformat_id:
            # document print format (A4, A3, Legal, ...)
            if paperformat_id.format == 'custom':
                args['paperWidth'] = good2bad(paperformat_id.page_width)
                args['paperHeight'] = good2bad(paperformat_id.page_height)
            elif paperformat_id.format:
                for fmt in PAPER_SIZES:
                    if fmt['key'] == paperformat_id.format:
                        args['paperWidth'] = good2bad(fmt['width'])
                        args['paperHeight'] = good2bad(fmt['height'])
                        break

            # document margins
            if specific_paperformat_args and specific_paperformat_args.get('data-report-margin-top'):
                args['marginTop'] = good2bad(specific_paperformat_args['data-report-margin-top'])
            else:
                args['marginTop'] = good2bad(paperformat_id.margin_top)
            args['marginLeft'] = good2bad(paperformat_id.margin_left)
            args['marginRight'] = good2bad(paperformat_id.margin_right)
            args['marginBottom'] = good2bad(paperformat_id.margin_bottom)

            # document orientation
            if not landscape and paperformat_id.orientation:
                args['landscape'] = paperformat_id.orientation == 'Landscape'
        else:
            args['landscape'] = landscape
        return args


    @api.model
    def _print_chrome(
        self,
        rendered,
        landscape=False,
        specific_paperformat_args=None,
        set_viewport_size=False,
    ):
        paperformat_id = self.get_paperformat()
        chrome_print_args = self._build_chrome_print_args(
            paperformat_id,
            landscape,
            specific_paperformat_args=specific_paperformat_args,
            set_viewport_size=set_viewport_size,
        )

        temporary_files = []

        # Write html version of document on disk so that it can be opened with headless chrome,
        # this requires the chrome flag `--disable-web-security` otherwise we get CORS errors.
        # Another solution would be to inject the user's session cookie into Chrome, navigating
        # to the corresponding document's HTML view and printing that, but it'd produce a lot of
        # HTTP requests which IIRC the Odoo.sh team seemed to want to avoid.
        html_file_fd, html_file_path = tempfile.mkstemp(suffix='.html', prefix='report.tmp.')
        with closing(os.fdopen(html_file_fd, 'wb')) as body_file:
            body_file.write(rendered)
        temporary_files.append(html_file_path)

        browser.Page.enable()
        browser.Network.enable()
        browser.Runtime.enable()
        # For the two resolve calls below, we may want to set the timeout to the request timeout
        # of the server, as the amount of time taken to both load the HTML file and to
        # generate a PDF from said file scale according to the size of the HTML file
        browser.Page.navigate(f"file://{html_file_path}").resolve()
        result = browser.Page.printToPDF(**chrome_print_args).resolve()

        for temporary_file in temporary_files:
            try:
                os.unlink(temporary_file)
            except (OSError, IOError):
                _logger.exception("Failed to remove temporary file %s", temporary_file)
        return result

    @api.model
    def _html2pdf(self,
        bodies,
        report_ref=False,
        header=None,
        footer=None,
        landscape=False,
        specific_paperformat_args=None,
        set_viewport_size=False):

        paperformat_id = self._get_report(report_ref).get_paperformat() if report_ref else self.get_paperformat()

        command_args = self._build_chrome_print_args(
            paperformat_id,
            landscape,
            specific_paperformat_args=specific_paperformat_args,
            set_viewport_size=set_viewport_size)