# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from PyPDF2 import PdfFileWriter, PdfFileReader
from PyPDF2.generic import DictionaryObject, DecodedStreamObject, NameObject, createStringObject, ArrayObject
from PyPDF2.utils import b_
from datetime import datetime

import io
import hashlib


DEFAULT_PDF_DATETIME_FORMAT = "D:%Y%m%d%H%M%S+00'00'"


def merge_pdf(pdf_data):
    ''' Merge a collection of PDF documents in one
    :param list pdf_data: a list of PDF datastrings
    :return: a unique merged PDF datastring
    '''
    writer = PdfFileWriter()
    for document in pdf_data:
        reader = PdfFileReader(io.BytesIO(document), strict=False)
        for page in range(0, reader.getNumPages()):
            writer.addPage(reader.getPage(page))
    _buffer = io.BytesIO()
    writer.write(_buffer)
    merged_pdf = _buffer.getvalue()
    _buffer.close()
    return merged_pdf


class OdooPdfFileReader(PdfFileReader):
    # OVERRIDE of PdfFileReader to add the management of multiple embedded files.

    def getAttachments(self):
        ''' Get embedded attachments inside the reader.
        :return: A list of dictionary containing:
            * filename: The name of the file to embed (require).
            * content:  The content of the file encoded in base64 (require).
            * object:   A PyPDF2.generic object for internal usage (don't use it).
        '''
        files = []
        if self.trailer['/Root'].get('/Names') and self.trailer['/Root']['/Names'].get('/EmbeddedFiles'):
            # N.B: embedded_files looks like:
            # ['file.xml', {'/Type': '/Filespec', '/F': 'file.xml', '/EF': {'/F': IndirectObject(22, 0)}}]
            embedded_files = self.trailer['/Root']['/Names']['/EmbeddedFiles']['/Names']
            # '[::2]' because it's a list [fn_1, content_1, fn_2, content_2, ..., fn_n, content_2]
            for filename_obj, content_obj in list(zip(embedded_files, embedded_files[1:]))[::2]:
                content = content_obj.getObject()['/EF']['/F'].getData()
                files.append({
                    'filename': filename_obj,
                    'content': content,
                    'object': content_obj,
                })
        return files


class OdooPdfFileWriter(PdfFileWriter):
    # OVERRIDE of PdfFileWriter to add the management of multiple embedded files.

    def getAttachments(self):
        ''' Get embedded attachments inside the writer.
        :return: A list of dictionary containing:
            * filename: The name of the file to embed (require).
            * content:  The content of the file encoded in base64 (require).
            * object:   A PyPDF2.generic object for internal usage (don't use it).
        '''
        files = []
        if self._root_object.get('/Names') and self._root_object['/Names'].get('/EmbeddedFiles'):
            # N.B: embedded_files looks like:
            # ['file.xml', {'/Type': '/Filespec', '/F': 'file.xml', '/EF': {'/F': IndirectObject(22, 0)}}]
            embedded_files = self._root_object['/Names']['/EmbeddedFiles']['/Names']
            # '[::2]' because it's a list [fn_1, content_1, fn_2, content_2, ..., fn_n, content_2]
            for filename_obj, content_obj in list(zip(embedded_files, embedded_files[1:]))[::2]:
                content = content_obj.getObject()['/EF']['/F'].getData()
                files.append({
                    'filename': filename_obj,
                    'content': content,
                    'object': content_obj,
                })
        return files

    def _create_attachment_object(self, attachment):
        ''' Create a PyPdf2.generic object representing an embedded file.

        :param attachment: A dictionary containing:
            * filename: The name of the file to embed (require).
            * content:  The content of the file encoded in base64 (require).
        :return:
        '''
        file_entry = DecodedStreamObject()
        file_entry.setData(attachment['content'])
        file_entry.update({
            NameObject("/Type"): NameObject("/EmbeddedFile"),
            NameObject("/Params"):
                DictionaryObject({
                    NameObject('/CheckSum'): createStringObject(hashlib.md5(attachment['content']).hexdigest()),
                    NameObject('/ModDate'): createStringObject(datetime.now().strftime(DEFAULT_PDF_DATETIME_FORMAT)),
                    NameObject('/Size'): NameObject(str(len(attachment['content']))),
                }),
        })
        if attachment.get('subtype'):
            file_entry.update({
                NameObject("/Subtype"): NameObject(attachment['subtype']),
            })
        file_entry_object = self._addObject(file_entry)
        filename_object = createStringObject(attachment['filename'])
        filespec_object = DictionaryObject({
            NameObject("/AFRelationship"): NameObject("/Data"),
            NameObject("/Type"): NameObject("/Filespec"),
            NameObject("/F"): filename_object,
            NameObject("/EF"):
                DictionaryObject({
                    NameObject("/F"): file_entry_object,
                    NameObject('/UF'): file_entry_object,
                }),
            NameObject("/UF"): filename_object,
        })
        if attachment.get('description'):
            filespec_object.update({NameObject("/Desc"): createStringObject(attachment['description'])})
        return self._addObject(filespec_object)

    def addAttachments(self, attachments):
        ''' Embed files inside the PDF.

        :param attachments: A list of dictionary containing:
            * filename: The name of the file to embed (require).
            * content:  The content of the file encoded in base64 (require).
            * object:   A PyPDF2.generic object for internal usage (don't provide it yourself).
        '''
        attachments = self.getAttachments() + attachments
        attachments_objects = []
        attachments_filespecs = []
        # Construct a list like [fn_1, content_1, fn_2, content_2, ..., fn_n, content_2].
        for attachment in attachments:
            if attachment.get('object'):
                content_object = attachment.get('object')
            else:
                content_object = self._create_attachment_object(attachment)
            attachments_objects += [content_object.getObject()['/F'], content_object]
            attachments_filespecs.append(content_object)
        # Create object containing all embedded files.
        embedded_files_object = DictionaryObject({
            NameObject("/EmbeddedFiles"): DictionaryObject({
                NameObject("/Names"): ArrayObject(attachments_objects),
            }),
        })
        # Update root.
        self._root_object.update({
            NameObject("/AF"): self._addObject(ArrayObject(attachments_filespecs)),
            NameObject("/Names"): embedded_files_object,
            NameObject("/PageMode"): NameObject("/UseAttachments"),
        })
        # Embedding files feature is available since PDF-1.6:
        # see https://www.prepressure.com/pdf/basics/version
        self._header = b_("%PDF-1.6")

    def addAttachment(self, fname, fdata):
        # OVERRIDE
        # Shadow the 'addAttachment' super method to prevent overriding the existing attachment if exists.
        self.addAttachments([{'filename': fname, 'content': fdata}])

