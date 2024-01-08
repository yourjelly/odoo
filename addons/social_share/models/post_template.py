# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import OrderedDict
import base64
from io import BytesIO
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

    def _generate_image_bytes(self, record=None, replacement_renderers=None):
        # build a list for each subgraph in order of dependency as:
        # [[parent, child, sub_child], [child, sub_child], [sub_child]]
        # this is inefficient but only a few simple dependency graphs are expected
        renderer_from_layer = OrderedDict()
        def get_acyclic_dependencies(layer, encountered_layers=[]):
            if not layer.required_element_ids:
                return [[layer]]
            return [
                child_dependency + [layer]
                for child_layer in layer.required_element_ids
                for child_dependency in get_acyclic_dependencies(child_layer, encountered_layers + [layer])
                if child_layer not in encountered_layers
            ]
        acyclic_dependencies = [dependency_graph for layer in self.layers for dependency_graph in get_acyclic_dependencies(layer)]
        not_rendered_set = set()

        # prepare renderers
        image_from_layer = OrderedDict()
        for layer in self.layers:
            if replacement_renderers and layer.role and replacement_renderers.get(layer.role):
                renderer = replacement_renderers[layer.role]
            else:
                renderer_class, renderer_values = layer._get_renderer_values()[0]
                renderer = renderer_class(**renderer_values)
            record = record if record is not None else (self.env[self.model_id.model] if self.model_id else None)
            renderer_from_layer[layer] = renderer

        # determine hidden layers
        for layer, renderer in renderer_from_layer.items():
            hide_children = False
            if layer in not_rendered_set:
                hide_children = True
            layer_image = renderer.render_image(record=record)
            if layer_image is None:
                hide_children = True
            if hide_children:
                for graph_id, dependency_graph in enumerate(acyclic_dependencies):
                    if dependency_graph[0] == layer:
                        for graph_element in dependency_graph:
                            not_rendered_set.add(graph_element)
                        acyclic_dependencies.pop(graph_id)
            image_from_layer[layer] = (renderer.pos, layer_image)

        # assemble image
        canvas_image = Image.new('RGBA', TEMPLATE_DIMENSIONS, color=(0, 0, 0))
        for layer, (pos, image) in image_from_layer.items():
            if layer not in not_rendered_set:
                canvas_image.paste(image, pos, image)

        canvas_image_bytes = BytesIO()
        canvas_image.convert('RGB').save(canvas_image_bytes, "PNG")
        return canvas_image_bytes.getvalue()
