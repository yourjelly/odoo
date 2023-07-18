import re
import uuid
from base64 import b64decode

from odoo.upgrade import util
from odoo.tools.mimetypes import guess_mimetype
from odoo.addons.web_editor.models.ir_attachment import SUPPORTED_IMAGE_MIMETYPES
from odoo.tools import image_process

print ("=======================")
print ("migration script start")
print ("=======================")

def migrate(cr, installed_version):
    # import ipdb; ipdb.set_trace()
    env = util.env(cr)

    tasks = env['project.task'].search([])
    # TODO: white-list mime types? white-list base64 characters?
    # pattern = r'<img [^>]*?src="(data:image/[^;>]+;base64,([^">]+))"[^<]*?>'
    pattern = re.compile(r"""
        <img                # img element opening tag
        \s                  # Whitespace   (use word boundary instead?)
        [^>]*?              # Anything except the closing tag
        src="(               # src attribute (1st capturing group)
            data:image/[^;>]+; # white list mime types?
            base64,([^">]+)    # base64-encoded image (2nd capturing group)
        )"
        [^<]*?              # Anything except a new opening tag
        >                   # closing tag
    """, re.VERBOSE)

    for task in tasks:
        print("-----------------------------")
        print("Task name:", task.name)
        if not task.description:
            print("(no task description)")
            continue
        # description = pattern.sub(replace_src, task.description)
        # print(description)
        # Stores (index span old src, new src)
        replacements = []
        for match in re.finditer(pattern, task.description):
            b64_encoded_image = match.group(2)
            attachment = add_attachment(env, b64_encoded_image)
            # TODO: handle error
            new_src = attachment['image_src']
            replacements.append((match.span(1), new_src))

            # debug info
            print("src:", short(match.group(1)))
            print("base64-encoded image:", short(b64_encoded_image))
        
        if (len(replacements)):
            new_description = make_replacements(task.description, replacements)
            print("new description:", new_description)
            # Commit change
            task.description = new_description

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
    # data = image_process(data)
    mimetype = guess_mimetype(data)
    if mimetype not in SUPPORTED_IMAGE_MIMETYPES:
        return {'error': "mimetype not supported"}
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
