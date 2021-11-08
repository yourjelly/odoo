# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from PyPDF2 import PdfFileWriter, PdfFileReader
from PyPDF2.generic import DictionaryObject, NameObject, ArrayObject, ByteStringObject, DecodedStreamObject, NumberObject, createStringObject
from sys import platform
from subprocess import Popen, PIPE
from logging import getLogger
from zlib import compress
from datetime import datetime

from odoo.tools.misc import file_open

import io
import hashlib


DEFAULT_PDF_DATETIME_FORMAT = "D:%Y%m%d%H%M%S+00'00'"


_logger = getLogger(__name__)


def _get_ghostscript_bin():
    commands = {
        'win32': ['gswin64c', 'gswin32c'],
        'darwin': ['gsos2'],
        'linux': ['gs'],
    }

    # On windows we could have different version. Try both of them.
    for command in commands.get(platform, ['gs']):
        try:
            Popen([command, '--version'], stdout=PIPE, stderr=PIPE)
            return command
        except (OSError, IOError):
            continue

    _logger.info('You need Ghostscript to print a PDF/A-3 version of your invoice.')
    return False


# make sure values are unwrapped by calling the specialized __getitem__
def _unwrapping_get(self, key, default=None):
    try:
        return self[key]
    except KeyError:
        return default


DictionaryObject.get = _unwrapping_get


class BrandedFileWriter(PdfFileWriter):
    def __init__(self):
        super().__init__()
        self.addMetadata({
            '/Creator': "Odoo",
            '/Producer': "Odoo",
        })


PdfFileWriter = BrandedFileWriter


def merge_pdf(pdf_data):
    ''' Merge a collection of PDF documents in one.
    Note that the attachments are not merged.
    :param list pdf_data: a list of PDF datastrings
    :return: a unique merged PDF datastring
    '''
    writer = PdfFileWriter()
    for document in pdf_data:
        reader = PdfFileReader(io.BytesIO(document), strict=False)
        for page in range(0, reader.getNumPages()):
            writer.addPage(reader.getPage(page))
    with io.BytesIO() as _buffer:
        writer.write(_buffer)
        return _buffer.getvalue()


def rotate_pdf(pdf):
    ''' Rotate clockwise PDF (90°) into a new PDF.
    Note that the attachments are not copied.
    :param pdf: a PDF to rotate
    :return: a PDF rotated
    '''
    writer = PdfFileWriter()
    reader = PdfFileReader(io.BytesIO(pdf), strict=False)
    for page in range(0, reader.getNumPages()):
        page = reader.getPage(page)
        page.rotateClockwise(90)
        writer.addPage(page)
    with io.BytesIO() as _buffer:
        writer.write(_buffer)
        return _buffer.getvalue()

# by default PdfFileReader will overwrite warnings.showwarning which is what
# logging.captureWarnings does, meaning it essentially reverts captureWarnings
# every time it's called which is undesirable
old_init = PdfFileReader.__init__
PdfFileReader.__init__ = lambda self, stream, strict=True, warndest=None, overwriteWarnings=True: \
    old_init(self, stream=stream, strict=strict, warndest=None, overwriteWarnings=False)

class OdooPdfFileReader(PdfFileReader):
    # OVERRIDE of PdfFileReader to add the management of multiple embedded files.

    ''' Returns the files inside the PDF.
    :raises NotImplementedError: if document is encrypted and uses an unsupported encryption method.
    '''
    def getAttachments(self):
        if self.isEncrypted:
            # If the PDF is owner-encrypted, try to unwrap it by giving it an empty user password.
            self.decrypt('')

        try:
            file_path = self.trailer["/Root"].get("/Names", {}).get("/EmbeddedFiles", {}).get("/Names")
        except Exception:
            # malformed pdf (i.e. invalid xref page)
            return []

        if not file_path:
            return []
        for i in range(0, len(file_path), 2):
            attachment = file_path[i+1].getObject()
            yield (attachment["/F"], attachment["/EF"]["/F"].getObject().getData())


class OdooPdfFileWriter(PdfFileWriter):
    # OVERRIDE of PdfFileWriter to add the management of multiple embedded files and PDFA.

    def __init__(self, *args, **kwargs):
        """
        Override of the init to initialise additional variables.
        :param pdf_content: if given, will initialise the reader with the pdf content.
        """
        super().__init__(*args, **kwargs)
        self._is_pdfa = False

        self._attachments_data = []
        self._metadata = None

        # Set odoo as producer
        self.addMetadata({
            '/Creator': "Odoo",
            '/Producer': "Odoo",
        })

    def cloneReaderDocumentRoot(self, reader):
        """
        Override from the base class to set the header properly, as well as give an id to the pdf.
        The base class would always write PDF-1.3 without the additional bytes required by PDF/A, and always
        remove the id.
        """
        super().cloneReaderDocumentRoot(reader)
        # Set the PDF version to 1.7 (as PDF/A-3 are in version 1.7) and append some more bytes required by PDF/A
        self._header = "%PDF-1.7\n%����".encode()
        # Add a document ID to the trailer
        pdf_id = ByteStringObject(hashlib.md5(reader.stream.getvalue()).digest())
        self._ID = ArrayObject((pdf_id, pdf_id))

    def addAttachment(self, fname, fdata, fsubtype=""):
        """
        Override the base class to delai the addition post ghostscript call, as well as properly add them to fit with
        PDF/A standard.
        Add an attachment to the pdf. The attachment will only be written in the file later in _embed_attachments.
        :param fname: The name of the attached file
        :param fdata: The data of the attached file
        :param fsubtype: The eventual subtype of the attached file (required by PDF/A-3)
        """
        self._attachments_data.append({
            'filename': fname,
            'content': fdata,
            'subtype': fsubtype,  # optional
        })

    def write(self, stream):
        """
        Override from the base class to support converting to PDF/A at the moment of writing.
        :param stream: the stream, to which we are writing the output
        """
        if self._is_pdfa:
            self._convert_to_pdfa(stream)
        else:
            self._embed_attachments()
            super().write(stream)

    def enable_pdfa(self):
        """
        Mark this writer as using pdfa. This will enable the conversion to pdf/a when writing to the stream.
        """
        self._is_pdfa = _get_ghostscript_bin() is not False

    def _convert_to_pdfa(self, stream):
        """
        Take the content of a pdf generated by wkhtmltopdf and use ghostscript to make PDF/A-3B compliant.
        :return: a PDF/A-3B compliant file
        """
        # Replace the DOCINFO as wkhtmltopdf export one with utf-16be characters and ghostscript doesn't like it.
        info = self.getObject(self._info)
        info.update({
            NameObject("/Creator"): createStringObject(""),
            NameObject("/Title"): createStringObject("")
        })
        super().write(stream)
        pdfa_content = pdf_content = stream.getvalue()

        gs_bin = _get_ghostscript_bin()
        if gs_bin:
            try:
                cmd = [
                    gs_bin,
                    '-dQUIET',  # Remove all routine information from the output
                    '-dPDFA=3',  # Generate a PDF/A-3 file
                    '-dBATCH',
                    '-dNOPAUSE',
                    '-dSAFER',  # Using DSAFER disallow access to the files on the system.
                    '-sColorConversionStrategy=UseDeviceIndependentColor',
                    '-sProcessColorModel=DeviceRGB',
                    '-sDEVICE=pdfwrite',
                    '-dPDFACompatibilityPolicy=1',  # Discard features that would result in a not PDF/A compliant file
                    '-sOutputFile=-',  # "-" as output file makes it write to stdout instead of a file
                    '-',  # "-" as input file is required since we provide the data from stdin
                ]
                # Run the command in a new subprocess. Use communicate to send the file input, and get the output
                process = Popen(cmd, stdin=PIPE, stderr=PIPE, stdout=PIPE)
                pdfa_content, error = process.communicate(pdf_content)

                if error:
                    _logger.error("Error while converting PDF to PDF/A: %s", error)
                    pdfa_content = pdf_content
            except FileNotFoundError as error:
                _logger.error("Error while calling Ghostscript: %s", error)
                pdfa_content = pdf_content

        reader_buffer = io.BytesIO(pdfa_content)
        reader = PdfFileReader(reader_buffer)
        post_writer = OdooPdfFileWriter()
        post_writer.cloneReaderDocumentRoot(reader)

        # We have to create a new pdf writer with the content post-pdfa conversion.
        # Embed the .icc color profile to the pdf
        with file_open('tools/data/files/sRGB2014.icc', mode='rb') as icc_profile:
            icc_profile_file_data = compress(icc_profile.read())

        icc_profile_stream_obj = DecodedStreamObject()
        icc_profile_stream_obj.setData(icc_profile_file_data)
        icc_profile_stream_obj.update({
            NameObject("/Filter"): NameObject("/FlateDecode"),
            NameObject("/N"): NumberObject(3),
            NameObject("/Length"): NameObject(str(len(icc_profile_file_data))),
        })

        icc_profile_obj = post_writer._addObject(icc_profile_stream_obj)

        output_intent_dict_obj = DictionaryObject()
        output_intent_dict_obj.update({
            NameObject("/S"): NameObject("/GTS_PDFA1"),
            NameObject("/OutputConditionIdentifier"): createStringObject("sRGB"),
            NameObject("/DestOutputProfile"): icc_profile_obj,
            NameObject("/Type"): NameObject("/OutputIntent"),
        })

        output_intent_obj = post_writer._addObject(output_intent_dict_obj)
        post_writer._root_object.update({
            NameObject("/OutputIntents"): ArrayObject([output_intent_obj])
        })

        for attachment in self._attachments_data:
            fname, fdata, fsubtype = attachment.values()
            post_writer.addAttachment(fname, fdata, fsubtype)
        post_writer.add_file_metadata(self._metadata)

        # Clear the stream that has been passed from the code that calls wkhtmltopdf then write the PDF/A version in it
        stream.seek(0)
        stream.truncate(0)
        post_writer.write(stream)
        reader_buffer.close()

    def add_file_metadata(self, metadata):
        """
        Set the metadata of the pdf. The metadata will only be written in the file later in _embed_attachments.
        :param metadata: bytes of the metadata to add to the pdf.
        """
        self._metadata = metadata

    def _embed_attachments(self):
        """
        This is done after passing through ghostscript as tests have shown that it would change or remove the attachment
        while converting.
        """
        if self._attachments_data:
            attachments = []
            if self._root_object.get('/Names') and self._root_object['/Names'].get('/EmbeddedFiles'):
                names_array = self._root_object["/Names"]["/EmbeddedFiles"]["/Names"]
                for attachment_data in self._attachments_data:
                    attachment = self._create_attachment_object(attachment_data)
                    attachments.append(attachment)
                    names_array.extend([attachment.getObject()['/F'], attachment])
            else:
                names_array = ArrayObject()

                for attachment_data in self._attachments_data:
                    attachment = self._create_attachment_object(attachment_data)
                    attachments.append(attachment)
                    names_array.extend([attachment.getObject()['/F'], attachment])

                embedded_files_names_dictionary = DictionaryObject()
                embedded_files_names_dictionary.update({
                    NameObject("/Names"): names_array
                })
                embedded_files_dictionary = DictionaryObject()
                embedded_files_dictionary.update({
                    NameObject("/EmbeddedFiles"): embedded_files_names_dictionary
                })
                self._root_object.update({
                    NameObject("/Names"): embedded_files_dictionary
                })

            if self._root_object.get('/AF'):
                attachment_array = self._root_object['/AF']
                attachment_array.extend(attachments)
            else:
                # Create a new object containing an array referencing embedded file
                # And reference this array in the root catalogue
                attachment_array = self._addObject(ArrayObject(attachments))
                self._root_object.update({
                    NameObject("/AF"): attachment_array
                })
            # Empty the attachment list to not write multiple times the same attachment if we call write more than once.
            self._attachments_data = []

        if self._metadata:
            file_entry = DecodedStreamObject()
            file_entry.setData(self._metadata)
            file_entry.update({
                NameObject("/Type"): NameObject("/Metadata"),
                NameObject("/Subtype"): NameObject("/XML"),
                NameObject("/Length"): NameObject(str(len(self._metadata))),
            })

            # Add the new metadata to the pdf, then redirect the reference to refer to this new object.
            metadata_object = self._addObject(file_entry)
            self._root_object.update({NameObject("/Metadata"): metadata_object})

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
