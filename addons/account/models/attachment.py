# -*- coding: utf-8 -*-

import base64
import io
import logging
import requests
import zipfile
from os.path import join
from lxml import etree, objectify

from odoo import models, tools

_logger = logging.getLogger(__name__)


class Attachment(models.Model):
    _inherit = "ir.attachment"

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

    def _load_xsd_files(self, urls, module_name, file_name=None, to_modify=None):
        """
        :return list: returns list of filestore path or files downloaded from URL
        :param urls: list of URLs to look for XSD files
        :param module_name: name of the module which is invoking this function
        :param file_name: name of the XSD file to be extracted if `url` points to compressed file
        :param to_modify: True depict the content needs to be post processed
        """
        attachments = self.env['ir.attachment']
        for url in urls:
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
