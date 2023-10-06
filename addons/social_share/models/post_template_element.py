# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from io import BytesIO
import base64
import requests
from PIL import ImageDraw, ImageFont, Image

from odoo import _, api, fields, models
from odoo.tools.misc import file_path
from odoo.modules.module import get_module_filetree

def _get_file_paths_ending_with(tree, path, extension):
    """Go through a file tree and return a list of paths to files ending with the specified extension.

    :param dict[str, dict|None] tree: the file (sub-)tree, with {folder_name: {subtree}, file_name: None}
    :param str path: the path to the (sub-tree)
    :return list[str]: list of paths to the files
    """
    ttf_files = []
    path = path.rstrip('/')
    for node, value in tree.items():
        new_path = f'{path}/{node}'
        if value is None and node.endswith(extension):
            ttf_files.append(new_path)
        elif isinstance(value, dict):
            ttf_files += _get_file_paths_ending_with(value, new_path, extension)
    return ttf_files

class PostTemplateElement(models.Model):
    _name = 'social.share.post.template.element'
    _order = 'sequence, id DESC'

    def _get_available_fonts():
        path = 'static/fonts/'
        tree = get_module_filetree('web', dir=path)
        ttf_paths = _get_file_paths_ending_with(tree, path, '.ttf')
        return [(ttf_path, ttf_path.split('/')[-1]) for ttf_path in ttf_paths]

    name = fields.Char()
    type = fields.Selection([('txt', 'Static Text'),
                             ('img', 'Static Image'),
                             ('usr_txt', 'User Text'),
                             ('field_txt', 'Field Text'),
                             ('img_url', 'Image URL')], default='img', required=True)
    # TODO Choose
    # As fields on templates: elements agnostic to flow, easy to replace and reference
    # As role tag: Takes much less space, easier to just filter editable elements
    role = fields.Selection([
        ('background', 'Background'),
        ('header', 'Background'),
        ('subheader', 'Background'),
        ('sharer_name', 'Background'),
        ('sharer_position', 'Background'),
        ('sharer_company', 'Background'),
        ('button', 'Background'),
        ('profile_image', 'Background'),
        ('logo', 'Background')
    ])
    text = fields.Text()
    text_font_size = fields.Integer(default="16")
    text_font = fields.Selection(selection=_get_available_fonts())
    text_color = fields.Char(default='ffffff')
    image_crop = fields.Selection([('circle', 'Circle')])
    image = fields.Image()
    image_url = fields.Char()
    model_id = fields.Many2one('ir.model', related="template_id.model_id")
    model = fields.Char(related='model_id.model')
    field = fields.Char()

    x_pos = fields.Integer(default=0, required=True)
    y_pos = fields.Integer(default=0, required=True)
    x_size = fields.Integer(default=0, required=True)
    y_size = fields.Integer(default=0, required=True)

    sequence = fields.Integer(default=1, required=True)
    template_id = fields.Many2one('social.share.post.template')

    @staticmethod
    def _get_raw_font(path):
        try:
            return file_path(f'web/{path}')
        except IOError:
            return None

    def _get_position(self):
        return (self.x_pos, self.y_pos)
    def _get_size(self):
        return (self.x_size, self.y_size)

    def _get_font(self):
        font = None
        if self.text_font:
            font = self._get_raw_font(self.text_font)
        if font:
            return ImageFont.truetype(font, self.text_font_size)
        return ImageFont.load_default()

    def _get_color(self):
        r, g, b = (int(self.text_color[start:start + 2], 16) for start in range(0, 6, 2))
        return (r, g, b)

    def get_image(self):
        if self.image:
            return self.image
        elif self.image_url:
            try:
                response = requests.request('get', self.image_url, timeout=5)
                return base64.b64encode(response.content)
            except (requests.exceptions.Timeout, requests.exceptions.ConnectionError, requests.exceptions.HTTPError):
                return None
        return None

    def get_text(self, record=None):
        if self.type == 'txt':
            return self.text
        elif self.type == 'field_txt':
            if record:
                return record[self.field]
            # get translated field name
            field_name = self.env['ir.model.fields'].sudo().search([
                ('model_id', '=', self.model_id.id), ('name', '=', self.field)
            ], limit=1).name
            return f'[{field_name}]'
        elif self.type == 'usr_txt':
            return _('User Text')
        return None
