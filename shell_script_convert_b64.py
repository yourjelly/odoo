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
        ('store', '=', True)
    ])
    return [(field.model_id.model, field.name) for field in html_fields]

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
        content = record[field]
        if not content:
            return 0
        replacements = []
        for match in re.finditer(pattern, content):
            b64_encoded_image = match.group('b64data')
            try:
                attachment = add_attachment(b64_encoded_image)
                new_src = attachment['image_src']
                replacements.append((match.span('src'), new_src))

                if DEBUG:
                    log_image_info(match)


            except Exception as e:
                print(f"ERROR: {record._name} id {record.id} {field}: "
                      f"Conversion of base64-encoded image to attachment failed.")
                print(f"src={short(match.group('src'))}")
                print("Error message:", e)
        
        if (replacements):
            # Database write
            record[field] = make_replacements(content, replacements)
        return (len(replacements))

    def make_replacements(text, replacements):
        shift_index = 0
        for span, new_src in replacements:
            start, end = map(lambda i: i + shift_index, span)
            text = text[:start] + new_src + text[end:]
            shift_index += len(new_src) - (end - start)
        return text

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
        attachment = env['ir.attachment'].create(attachment_data)
        return attachment._get_media_info()

    for model, field in models_and_fields:
        count_updated_records = 0
        # recordset = env[model].search([(field, 'like', "src=_data:image")]) 
        recordset = env[model].search([]) 
        for record in recordset:
            num_replacements = convert_b64images_to_attachments(record, field)
            if (num_replacements):
                log_replacements(record, field, num_replacements)
                count_updated_records += 1

        log_count(model, field, count_updated_records)


# Logging utils
def short(text):
    if (len(text) <= 80):
        return text
    return text[:38] + '....' + text[-38:]

def log_replacements(record, field, num_replacements):
    print(  f"{record._name} {field} record id {record.id} "
            f"({getattr(record, 'name', '')}) updated, "
            f"{num_replacements} image(s) converted to attachment")

def log_count(model, field, count):
    print(f"{model} {field}: {count} record(s) updated")
    print("-----------------------------------")

def log_image_info(match):
    print("------------------")
    print("src:", short(match.group('src')))
    b64data = match.group('b64data')
    print("base64-encoded image:", short(b64data))
    size_MB = len(b64data) / (1024 * 1024)
    print(f"Estimated size in DB: {size_MB:.1f}MB")
    print("------------------")
