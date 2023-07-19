import re
import uuid
from base64 import b64decode

from odoo.upgrade import util
from odoo.tools.mimetypes import guess_mimetype
from odoo.addons.web_editor.models.ir_attachment import SUPPORTED_IMAGE_MIMETYPES

print ("=======================")
print ("migration script start")
print ("=======================")

def migrate(cr, installed_version):
    # import ipdb; ipdb.set_trace()
    env = util.env(cr)

    pattern = re.compile(r"""
        <img                        # img element opening tag
        \s                          # Whitespace
        [^>]*?                      # Anything except closing tag, lazy
        src=                        # src attribute
        (?P<quote>['"])             # single or double quote
        (?P<src>                    # src value  
            data:image/
            (?:gif|jpe|jpe?g|png|svg(?:\+xml)?)  # allowed MIME types
            ;base64,
            (?P<b64data>[A-Za-z0-9+/=]+)    # base64-encoded image
        )
        (?P=quote)
        [^<]*?                      # Anything except opening tag, lazy
        >                           # closing tag
    """, re.VERBOSE)

    tasks = env['project.task'].search([])
    for task in tasks:
        print("-----------------------------")
        print("Task name:", task.name)
        if not task.description:
            print("(no task description)")
            continue
        # description = pattern.sub(replace_src, task.description)
        # print(description)
        # Stores (index span old src, new src)
        content = task.description
        replacements = []
        for match in re.finditer(pattern, content):
            b64_encoded_image = match.group('b64data')
            try:
                attachment = add_attachment(env, b64_encoded_image)
                new_src = attachment['image_src']
                replacements.append((match.span('src'), new_src))

                # debug info
                print("src:", short(match.group('src')))
                print("base64-encoded image:", short(b64_encoded_image))

            except Exception as e:
                print("Conversion of base64-encoded image to attachemnt failed:", e)
        
        if (replacements):
            modified_content = make_replacements(task.description, replacements)
            # debug log
            print("new description:", modified_content)
            # Commit change
            task.description = modified_content

def clean_html_fields(env):
    fields = [
        ('project.task', 'description'),
    ]



def make_replacements(text, replacements):
    shift_index = 0
    for span, new_src in replacements:
        start, end = map(lambda i: i + shift_index, span)
        text = text[:start] + new_src + text[end:]
        shift_index += len(new_src) - (end - start)

    # debug
    print(str(len(replacements)), "replacements made.")

    return text

# for debug only
def short(text):
    if (len(text) <= 80):
        return text
    return text[:38] + '....' + text[-38:]

def add_attachment(env, b64_encoded_data):
    data = b64decode(b64_encoded_data)
    mimetype = guess_mimetype(data)
    if mimetype not in SUPPORTED_IMAGE_MIMETYPES:
        raise ValueError("MIME type not supported")
    # TODO: better naming...
    name = 'test-' + str(uuid.uuid4()) + SUPPORTED_IMAGE_MIMETYPES[mimetype]
    attachment_data = {
        'name': name,
        'public': True,
        'res_id': False,
        'res_model': 'ir.ui.view',
        'raw': data
    }
    attachment = env['ir.attachment'].create(attachment_data)
    return attachment._get_media_info()
