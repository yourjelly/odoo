# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from io import BytesIO
import base64
import math
from PIL import ImageDraw, Image

from odoo import _, api, fields, models


TEMPLATE_DIMENSIONS = (700, 366)
TEMPLATE_RATIO = 40 / 21
FONTS = ['NotoSans-VF.ttf', 'NotoSans[wght].ttf', 'Cantarell-VF.otf']


class PostTemplate(models.Model):
    _name = 'social.share.post.template'

    name = fields.Char(required=True)
    image = fields.Image(compute="_compute_image")
    model_id = fields.Many2one(
        'ir.model', domain=lambda self: [('model', 'in', self._get_valid_target_models())],
        related='post_id.model_id', store=True
    )

    # if empty, is a generic copyable template
    post_id = fields.One2many('social.share.post', inverse_name='share_template_id')
    parent_id = fields.Many2one('social.share.post.template')

    # named layers expected on all templates
    background = fields.Image(compute='_compute_background', inverse='_inverse_background')
    header = fields.Many2one('social.share.post.template.element')
    subheader = fields.Many2one('social.share.post.template.element')
    sharer_name = fields.Many2one('social.share.post.template.element')
    sharer_position = fields.Many2one('social.share.post.template.element')
    sharer_company = fields.Many2one('social.share.post.template.element')
    button = fields.Many2one('social.share.post.template.element')
    profile_image = fields.Many2one('social.share.post.template.element')
    logo = fields.Many2one('social.share.post.template.element')

    layers = fields.One2many('social.share.post.template.element', inverse_name='template_id')

    def _get_valid_target_models(self):
        #TODO move to relevant modules if keeping in event module
        return ('event.registration', 'event.sponsor', 'event.track',
                'res.partner')  # to be removed?

    def _compute_background(self):
        for template in self:
            template.background = template.layers[0].get_image() if template.layers else None

    def _inverse_background(self):
        for template in self:
            template.layers += self.env['social.share.post.template.element'].create({
                'image': template.background,
                'name': 'background',
                'x_size': TEMPLATE_DIMENSIONS[0],
                'y_size': TEMPLATE_DIMENSIONS[1],
                'sequence': 0,
            })

    def copy_data(self, default=None):
        default = dict(default or {})
        default.setdefault('name', _("%s (copy)", self.name))
        return super().copy_data(default)

    @api.depends(lambda self: [f'layers.{field}' for field in self.env['social.share.post.template.element']._fields] + ['layers'])
    def _compute_image(self):
        self.image = self._generate_image_b64()

    def _generate_image_b64(self, record=None):
        return base64.encodebytes(self._generate_image_bytes(record=record))

    def _generate_image_bytes(self, record=None):
        final_image = Image.new('RGBA', TEMPLATE_DIMENSIONS, color=(0, 0, 0))
        for layer in self.layers:
            image_b64 = layer.get_image()
            text = layer.get_text(record)
            if image_b64:
                image = Image.open(BytesIO(base64.b64decode(image_b64))).convert('RGBA')
                if any(layer._get_size()):
                    image = image.crop((0, 0, *layer._get_size()))
                image = self._fit_to_mask(image, layer.image_crop)
                final_image.paste(image, layer._get_position(), image)
            elif text:
                font = layer._get_font()
                editor = ImageDraw.ImageDraw(final_image)
                if any(layer._get_size()):
                    text = self._justify_text(text, font, layer, editor)
                    self._check_text_height(text, font, layer, editor)
                editor.multiline_text(layer._get_position(), text, font=font, fill=layer._get_color() + (255,))
        final_image_bytes = BytesIO()
        final_image.convert('RGB').save(final_image_bytes, "PNG")
        return final_image_bytes.getvalue()

    @staticmethod
    def _justify_text(text, font, layer, editor):
        def get_line_width(line):
            start_x, dummy, end_x, dummy = editor.textbbox(layer._get_position(), line, font=font)
            return end_x - start_x

        # get length on one character in this font, W tends to be on the larger size
        one_char_width = get_line_width('w')

        if one_char_width > layer.x_size:
            raise Exception("The text cannot fit in the requested size with this font, increase width")
        text_lines = text.split('\n')
        final_text_lines = []
        for line in text_lines:
            line_width = get_line_width(line)
            if line_width > layer.x_size:
                estimated_overflow = math.ceil((line_width - layer.x_size) / one_char_width)
                split_index = text.rfind(' ', 0, len(text) - estimated_overflow)
                if split_index == -1:
                    split_index = len(text) - estimated_overflow
                line = text[:split_index] + '\n' + text[split_index + 1:]
                line_width = get_line_width(line)
            final_text_lines.append(line)
        return '\n'.join(final_text_lines)

    @staticmethod
    def _check_text_height(text, font, layer, editor):
        dummy, start_y, dummy, end_y = editor.textbbox(layer._get_position(), text, font=font)
        if end_y - start_y > layer.y_size:
            raise Exception("The text cannot fit in the requested size with this font, increase height")

    @staticmethod
    def _fit_to_mask(image, crop_type):
        if not crop_type:
            return image
        elif crop_type == 'circle':
            mask = Image.new('RGBA', (100, 100), color=(0, 0, 0, 0))
            ImageDraw.ImageDraw(mask).ellipse((0, 0, 90, 90), (255, 255, 255, 255))
            mask.paste(image.crop((0, 0, 100, 100)), (0, 0), mask)
            return mask
