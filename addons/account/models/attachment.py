# -*- coding: utf-8 -*-

import base64
import io
import json
import logging
import requests
import zipfile
from dateutil.relativedelta import relativedelta
from os.path import join
from lxml import etree, objectify

from odoo import fields, models, tools

_logger = logging.getLogger(__name__)


class Attachment(models.Model):
    _inherit = "ir.attachment"

    def _get_updated_urls(self, urls=None):
        # can be done from XML side as shown below, but we won't have formatted dictionary in `account.xsd_urls` parameter then
        # self.env.ref('account_xsd_url_data').value + <new_value>
        if not urls:
            urls = {}
        previous_urls = tools.safe_eval(self.env['ir.config_parameter'].sudo().get_param('account.xsd_urls', '{}'))
        previous_urls.update(urls)
        # also, activate the cron job that loads XSD files
        self.env.ref('account.ir_cron_load_xsd_file').write({
            'nextcall': (fields.Datetime.now() + relativedelta(years=-1)),
            'active': True
        })
        return json.dumps(previous_urls, sort_keys=True, indent=4)

    def _extract_xsd_content(self, response, file_name):
        """
        :return bytes: return read bytes
        :param response: response object
        :param file_name: the file name to be extracted from compressed file
        """
        bytes_content = io.BytesIO(response.content)
        if not zipfile.is_zipfile(bytes_content):
            return
        archive = zipfile.ZipFile(bytes_content)
        file = ''
        for file_path in archive.namelist():
            if file_name in file_path:
                file = file_path
                break
        try:
            return archive.open(file).read()
        except KeyError as e:
            _logger.info(e)
            return ''

    def _modify_xsd_content(self, module_name, content):
        """
        :return string: returns stringified content
        :param module_name: name of the module who is invoking this function(to be used by overridden methods)
        :param content: file content as bytes
        """
        return content

    def _validate_xsd_content(self, content):
        """
        :return object: returns ObjectifiedElement
        :param module_name: name of the module who is invoking this function(to be used by overridden methods)
        :param content: file content as bytes
        """
        try:
            return objectify.fromstring(content)
        except etree.XMLSyntaxError as e:
            _logger.warning('You are trying to load an invalid xsd file.\n%s', e)
            return ''

    def _load_xsd_files(self, modified_urls_info=None):
        """
        :return list: returns list of filestore path or files downloaded from URL
        :param modified_urls_info: dict

        If you want to load XSDs from URLs other than the ones configured for `account.xsd_urls` configuration parameter,
        you can pass such URL information in `modified_urls_info`.
        """
        attachments = self.env['ir.attachment']
        urls_info = modified_urls_info or tools.safe_eval(self.env['ir.config_parameter'].sudo().get_param('account.xsd_urls', '{}'))
        for module_name in urls_info:
            to_modify = urls_info.get(module_name, {}).get('to_modify')
            for url in urls_info.get(module_name, {}).get('urls', []):
                file_name = ''
                if isinstance(url, (tuple, list)) and len(url) == 2:
                    url, file_name = url
                # Skip further process if XSD is already cached into attachment
                fname = file_name or url.split('/')[-1]
                xsd_fname = 'xsd_cached_%s' % fname.replace('.', '_')
                attachment = self.env.ref('%s.%s' % (module_name, xsd_fname), False)
                if attachment:
                    continue
                # Check if URL is working or not
                try:
                    response = requests.get(url, timeout=10)
                    response.raise_for_status()
                except requests.exceptions.HTTPError as httpe:
                    _logger.warning('HTTP error %s with the given URL: %s' % (httpe.code, url))
                    continue
                if file_name:
                    # URL may contain a ZIP file or RAR or any compressed file. By default, it can extract XSD
                    # with given `file_name` from ZIP file. If an XSD file is to be extracted from other than
                    # ZIP files, then below method can be overridden and it must return XSD content at the end.
                    content = self._extract_xsd_content(response, file_name)
                else:
                    content = response.content
                if to_modify:
                    content = self._modify_xsd_content(module_name, content)
                # We validate the final content
                xsd_object = self._validate_xsd_content(content)
                if not len(xsd_object):
                    continue
                attachment = self.create({
                    'name': xsd_fname,
                    'datas': base64.encodebytes(content),
                })
                self.env['ir.model.data'].create({
                    'name': xsd_fname,
                    'module': module_name,
                    'res_id': attachment.id,
                    'model': 'ir.attachment',
                    'noupdate': True
                })
                attachments += attachment
        filestore = tools.config.filestore(self.env.cr.dbname)
        return [join(filestore, attachment.store_fname) for attachment in attachments]
