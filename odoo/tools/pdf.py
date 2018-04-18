# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import release
from odoo.tools import pycompat

from PyPDF2 import PdfFileWriter, PdfFileReader
from PyPDF2.generic import DictionaryObject, DecodedStreamObject, NameObject, createStringObject, ArrayObject
from PyPDF2.utils import b_
from datetime import datetime

import hashlib
import io

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


class OdooPdfFileWriter(PdfFileWriter):
    def __init__(self, reader=None, metadata=None):
        # OVERRIDE
        super(OdooPdfFileWriter, self).__init__()

        if reader:
            # Clone reader.
            self.cloneReaderDocumentRoot(reader)

            # Copy ID.
            if reader.trailer.get('/ID'):
                self._ID = reader.trailer['/ID']

        # Add Odoo metadata.
        self.addMetadata(self._get_odoo_metadata())

        # Add custom metadata.
        if metadata:
            self.addMetadata(metadata)

    @staticmethod
    def _get_odoo_metadata():
        now = datetime.now().strftime(DEFAULT_PDF_DATETIME_FORMAT)
        release_version = 'Odoo %s' % release.version
        return {
            '/Author': release_version,
            '/CreationDate': now,
            '/Creator': release_version,
            '/ModDate': now,
        }

    def getMetadata(self):
        return self.getObject(self._info)

    def getAttachments(self):
        files = []
        if self._root_object.get('/Names') and self._root_object['/Names'].get('/EmbeddedFiles'):
            # N.B: embedded_files looks like:
            # ['file.xml', {'/Type': '/Filespec', '/F': 'file.xml', '/EF': {'/F': IndirectObject(22, 0)}}]
            embedded_files = self._root_object['/Names']['/EmbeddedFiles']['/Names']
            # '[::2]' because it's a list [fn_1, content_1, fn_2, content_2, ..., fn_n, content_2]
            for filename_obj, content_obj in list(pycompat.izip(embedded_files, embedded_files[1:]))[::2]:
                content = content_obj.getObject()['/EF']['/F'].getData()
                files.append({
                    'filename': filename_obj, 'content': content,
                    'object': content_obj,
                })
        return files

    def _create_attachment_object(self, attachment):
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

    def addAttachmentsMetadata(self, data, subtype=None):
        # Create object containing metadata.
        metadata_object = DecodedStreamObject()
        metadata_object.setData(data)
        metadata_object.update({
            NameObject('/Type'): NameObject('/Metadata'),
        })
        if subtype:
            metadata_object.update({
                NameObject('/Subtype'): NameObject(subtype),
            })

        self._root_object.update({
            NameObject("/Metadata"): self._addObject(metadata_object),
        })


    def addAttachments(self, attachments):
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
