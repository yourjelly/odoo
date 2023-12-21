# Part of Odoo. See LICENSE file for full copyright and licensing details.

import os
import math
from PIL import Image, ImageDraw, ImageFont
from functools import lru_cache

from odoo import _, models
from odoo.exceptions import UserError
from odoo.modules.module import get_module_path
from odoo.tools.misc import file_path
from ..utils.image_render_utils import align_text, get_rgb_from_hex
from .renderer import Renderer

@lru_cache()
def _get_font_name_to_path_map():
    walk = os.walk(get_module_path('web'))
    return {file: f'{path}/{file}' for path, _, files in walk for file in files if file.endswith('.ttf')}


class TextRenderer(Renderer):

    @staticmethod
    def _get_font_name_to_path_map():
        return _get_font_name_to_path_map()

    @staticmethod
    def _get_available_fonts():
        return [(file, file) for file in _get_font_name_to_path_map()]

    @staticmethod
    def _get_raw_font(path):
        try:
            return file_path(path)
        except IOError:
            return None

    def _get_font(self):
        self.ensure_one()
        font_map = self._get_font_name_to_path_map()
        font = None
        if self.text_font and font_map.get(self.text_font):
            font = self._get_raw_font(font_map[self.text_font])
        if font:
            return ImageFont.truetype(font, self.text_font_size)
        return ImageFont.load_default()

    def get_text(self):
        return ''

    def render_image(self):
        text = self.get_text()
        font = self._get_font()
        text_lines = align_text(text, font, ((0, 0), self._get_size()), self.text_align or 'left')
        # if biggest y and smallest Ys don't fit in the size
        max_y = text_lines[-1][0][1][1]
        min_y = text_lines[0][0][0][1]
        max_x = max(text_line[0][1][0] for text_line in text_lines)
        if self.y_size and (max_y > self.y_size or min_y < 0):
            raise UserError(_('The text "%(text)s" cannot fit in the requested height %(height)d', text=text, height=self.y_size))
        base_image = Image.new('RGBA', (math.ceil(max_x), math.ceil(max_y)), color=(0, 0, 0, 0))
        editor = ImageDraw.ImageDraw(base_image)
        for (pos, dummy), line in text_lines:
            editor.text(
                pos, line, font=font,
                fill=get_rgb_from_hex(self.text_color if self.text_color else 'ffffff'))
        return base_image

class UserTextRenderer(TextRenderer):

    def get_text(self):
        return self.text


class FieldTextRenderer(TextRenderer):

    def _get_proxy_fields(self):
        return super()._get_proxy_fields + ['_record']

    def __init__(self, template_element, record=False):
        self._record = record
        self._template_element = template_element

    def get_text(self):
        field = self.field_path
        if self._record:
            return self._record[field]
        elif isinstance(self._record, models.Model):
            field_name = self.env['ir.model.fields'].sudo().search([
                ('model_id', '=', self._record.name), ('name', '=', field)
            ], limit=1).name
            return f'[{field_name}]'
        return f'[{field}]'
