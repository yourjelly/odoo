# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, exceptions, fields, models
from .renderer_text import FieldTextRenderer, TextRenderer, UserTextRenderer
from .renderer_image import ColorShapeRenderer, ImageShapeRenderer

render_class_from_type = {
    'image': {
        'static': ImageShapeRenderer
    },
    'shape': {
        'static': ColorShapeRenderer
    },
    'text': {
        'static': UserTextRenderer,
        'field': FieldTextRenderer
    },
}

text_option_fields= (
    'text_align',
    'text_align_vert',
    'text_font_size',
    'text_font',
    'text_color',
)

reset_dict_from_type = {
    'image': {
        'static': {field: False for field in ('field_path', 'text', 'color', *text_option_fields)}
    },
    'shape': {
        'static': {field: False for field in ('field_path', 'text', 'image', *text_option_fields)}
    },
    'text': {
        'static': {field: False for field in ('field_path', 'color', 'image', 'shape')},
        'field': {field: False for field in ('text', 'color', 'image', 'shape')}
    },
}


class ImageRenderElement(models.Model):
    _name = 'social.share.image.render.element'
    _description = 'Social Share Template Layer'
    _rec_name = 'role'
    _order = 'sequence, id DESC'

    role = fields.Selection([
        ('background', 'Background'),
        ('header', 'Header'),
        ('subheader', 'Sub-Header'),
        ('section-1', 'Section 1'),
        ('subsection-1', 'Sub-Section 1'),
        ('subsection-2', 'Sub-Section 2'),
        ('button', 'Button'),
        ('image-1', 'Image 1'),
        ('image-2', 'Image 2')
    ])

    post_id = fields.Many2one('social.share.post', ondelete="cascade")
    template_id = fields.Many2one('social.share.post.template', ondelete="cascade")
    model = fields.Char(compute='_compute_model')

    x_pos = fields.Integer(default=0, required=True)
    y_pos = fields.Integer(default=0, required=True)
    x_size = fields.Integer(default=0, required=True)
    y_size = fields.Integer(default=0, required=True)

    sequence = fields.Integer(default=1, required=True)

    type = fields.Selection([('image', 'Image'), ('shape', 'Shape'), ('text', 'User Text')], default='text', required=True)
    value_type = fields.Selection([('static', 'Static'), ('field', 'Field'), ('url', 'URL')], default='static', required=True)

    # shapes generic
    shape = fields.Selection([('rect', 'Rectangle'), ('roundrect', 'Rounded Rectangle'), ('circ', 'Circle')], default='rect')
    # image shape
    image = fields.Image()
    # color shape
    color = fields.Char()

    # text generic
    text_align = fields.Selection([('left', 'Left'), ('center', 'Center')])
    text_align_vert = fields.Selection([('top', 'Top'), ('center', 'Center')])
    text_font_size = fields.Integer()
    text_font = fields.Selection(selection=TextRenderer._get_available_fonts())
    text_color = fields.Char()

    # text user input
    text = fields.Text()

    # text field
    field_path = fields.Char()

    _sql_constraints = [('role_uniq', "unique(template_id, post_id, role)", "Each template and post should only have one element for each role.")]


    def _compute_model(self):
        for element in self:
            element.model = element.template_id.model_id.model or element.post_id.model_id.model

    @api.constrains('type', 'value_type')
    def _check_type_combination(self):
        for element in self:
            if not element._get_renderer_class():
                raise exceptions.ValidationError(_('%(dynamic_type)s %(output_type)s cannot be rendered', dynamic_type=self.value_type, output_type=self.type))

    @api.onchange('type', 'value_type')
    def _onchange_type(self):
        for element in self:
            if reset_dict_from_type.get(element.type, {}).get(element.value_type):
                element.write(reset_dict_from_type[element.type][element.value_type])

    def _get_renderer(self, record=None):
        return self._get_renderer_class()(self, record=record)

    def _get_renderer_class(self):
        return render_class_from_type.get(self.type, {}).get(self.value_type)
