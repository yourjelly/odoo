import re
import uuid
from base64 import b64decode

from odoo.tools.mimetypes import guess_mimetype
from odoo.addons.web_editor.models.ir_attachment import SUPPORTED_IMAGE_MIMETYPES

DEBUG = True

def run(env):
    clean_html_fields(env, get_models(env))

def get_models(env):
    html_fields = env['ir.model.fields'].search([
        ('ttype', '=', 'html'),
        ('store', '=', True),
    ])
    models_and_fields = []
    for field in html_fields:
        model_name = field.model_id.model
        model = env[model_name]
        if not model._abstract and not model._transient:
            models_and_fields.append((model_name, field.name))
    return models_and_fields

def clean_html_fields(env, models_and_fields):

    pattern = re.compile(r"""
        <img                        # 'img' element opening tag
        \s                          # Whitespace
        [^>]*?                      # Anything except closing tag, lazy
        src=                        # 'src' attribute
        (?P<quote>['"])             # Single or double quote
        (?P<src>                    # 'src' value  
            data:image/
            (?:gif|jpe|jpe?g|png|svg(?:\+xml)?) # Allowed MIME types
            ;base64,
            (?P<b64data>[A-Za-z0-9+/=]+)        # Base64-encoded image
        )
        (?P=quote)
        [^<]*?                      # Anything except opening tag, lazy
        >                           # Closing tag
    """, re.VERBOSE) 

    def convert_b64images_to_attachments(record, field):
        """
            Returns (number of converted images, char count delta)
        """
        content = record[field]
        if not content:
            return (0, 0)
        replacements = []
        attachments = []
        for match in re.finditer(pattern, content):
            b64_encoded_image = match.group('b64data')
            try:
                attachment = add_attachment(b64_encoded_image)
            except Exception as e:
                log_conversion_error(record, field, match.group('src'), e)
            else:
                attachments.append(attachment)
                new_src = attachment._get_media_info()['image_src']
                replacements.append((match.span('src'), new_src))

        if (replacements):
            new_content, delta_size = make_replacements(content, replacements)
            try:
                record[field] = new_content
            except Exception as e:
                log_write_error(record, field, e)
                # TODO: test this
                for attachment in attachments:
                    attachment.unlink()
            else:
                return (len(replacements), delta_size)
        return (0, 0)

    def make_replacements(text, replacements):
        shift_index = 0
        for span, new_src in replacements:
            start, end = map(lambda i: i + shift_index, span)
            text = text[:start] + new_src + text[end:]
            shift_index += len(new_src) - (end - start)
        return text, shift_index

    def add_attachment(b64_encoded_data):
        data = b64decode(b64_encoded_data)
        mimetype = guess_mimetype(data)
        if mimetype not in SUPPORTED_IMAGE_MIMETYPES:
            raise ValueError("MIME type not supported")
        # TODO: better naming?
        name = str(uuid.uuid4()) + SUPPORTED_IMAGE_MIMETYPES[mimetype]
        attachment_data = {
            'name': name,
            'public': True,
            'res_id': False,
            'res_model': 'ir.ui.view',
            'raw': data
        }
        return env['ir.attachment'].create(attachment_data)

    total_record_update_count = 0
    total_size_saved_MB = 0
    for model, field in models_and_fields:
        model_record_count = 0
        model_size_reduction_MB = 0
        recordset = env[model].search([(field, 'like', "src=_data:image")]) 
        for record in recordset:
            num_replacements, size_delta = convert_b64images_to_attachments(record, field)
            if num_replacements:
                model_record_count += 1
                size_reduction_MB = -size_delta / (1024 * 1024)
                model_size_reduction_MB += size_reduction_MB
                log_record_update(record, field, num_replacements, size_reduction_MB)

        if model_record_count:
            log_model_report(model, model_record_count, model_size_reduction_MB)
            total_record_update_count += model_record_count
            total_size_saved_MB += model_size_reduction_MB
    log_totals(total_record_update_count, total_size_saved_MB)


# Logging utils
def short(text):
    if len(text) <= 80:
        return text
    return text[:38] + '....' + text[-38:]

def log_record_update(record, field, num_replacements, size_MB):
    print(  f"{record._name} (html field: {field}) record id {record.id} "
            f"({getattr(record, 'name', '')}) updated: "
            f"{num_replacements} image(s) converted to attachment, "
            f"{size_MB:.1f}MB reduction in field content size."
    )

def log_model_report(model, count, size_MB):
    print(f"{model}: {count} record(s) updated, delta: {size_MB:.1f}MB.")
    print("-----------------------------------")

def log_totals(record_count, size_MB):
    print(f"TOTAL: {record_count} record(s) updated, delta: {size_MB:.1f}MB.")

def log_image_info(match):
    print("------------------")
    print("src:", short(match.group('src')))
    b64data = match.group('b64data')
    print("base64-encoded image:", short(b64data))
    size_MB = len(b64data) / (1024 * 1024)
    print(f"Estimated size in DB: {size_MB:.1f}MB")
    print("------------------")

def log_conversion_error(record, field, src, exception):
    print(f"ERROR: {record._name} id {record.id} {field}: "
        f"Conversion of base64-encoded image to attachment failed.")
    print(f"src={short(src)}")
    print("Exception message:", exception)

def log_write_error(record, field, exception):
    print(  f"ERROR: {record._name} id {record.id} {field}: "
            f"Write operation failed.")
    print("Exception message:", exception)
