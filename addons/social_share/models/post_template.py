# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from io import BytesIO
import base64
from PIL import Image

from odoo import _, api, Command, fields, models

TEMPLATE_DIMENSIONS = (1200, 630)
TEMPLATE_RATIO = 40 / 21
FONTS = ['NotoSans-VF.ttf', 'NotoSans[wght].ttf', 'Cantarell-VF.otf']

class PostTemplate(models.Model):
    _name = 'social.share.post.template'
    _description = 'Social Share Template'

    name = fields.Char(required=True)
    image = fields.Image(compute='_compute_image')
    model_id = fields.Many2one(
        'ir.model', domain=lambda self: [('model', 'in', self._get_valid_target_models())],
    )

    # similar templates where preserving elements with 'roles' makes sense
    variant_ids = fields.One2many('social.share.post.template', inverse_name='parent_variant_id')
    parent_variant_id = fields.Many2one('social.share.post.template', copy=False)

    background = fields.Image(compute='_compute_background', inverse='_inverse_background')

    layers = fields.One2many('social.share.image.render.element', inverse_name="template_id", copy=True)

    # doesn't seem necessary yet
    #cache_group = fields.One2many('cache.group') _store=False  # groups of elements of which the render result can be cached for reuse

    def _get_valid_target_models(self):
        return self.env['social.share.field.allow'].search([]).sudo().field_id.model_id.mapped('model')

    def _compute_background(self):
        for template in self:
            template.background = template.layers[0].image if template.layers else None

    def _inverse_background(self):
        for template in self:
            template.layers += self.env['social.share.image.render.element'].create({
                'image': template.background,
                'name': 'background',
                'role': 'background',
                'x_size': TEMPLATE_DIMENSIONS[0],
                'y_size': TEMPLATE_DIMENSIONS[1],
                'sequence': 0,
            })

    @api.depends(lambda self: [f'layers.{field}' for field in self.env['social.share.image.render.element']._fields] + ['layers'])
    def _compute_image(self):
        for post in self:
            post.image = base64.encodebytes(post._generate_image_bytes())

    def _generate_image_bytes(self, record=None, replacement_values=None):
        canvas_image = Image.new('RGBA', TEMPLATE_DIMENSIONS, color=(0, 0, 0))
        for layer in self.layers:
            if replacement_values and layer.role and replacement_values.get(layer.role):
                layer = replacement_values[layer.role]
                sdkf;lssf
                # build the renderer with replaced values
            else:
                renderer = layer._get_renderer_class
            record = record or (self.env[self.model_id.model] if self.model_id else None)
            layer_image = .render_image()
            canvas_image.paste(layer_image, layer._get_position(), layer_image)

        canvas_image_bytes = BytesIO()
        canvas_image.convert('RGB').save(canvas_image_bytes, "PNG")
        return canvas_image_bytes.getvalue()
