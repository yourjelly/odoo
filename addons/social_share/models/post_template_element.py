# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, exceptions, fields, models
from .renderer_text import FieldTextRenderer, TextRenderer, UserTextRenderer
from .renderer_image import ColorShapeRenderer, ImageFieldShapeRenderer, ImageStaticShapeRenderer

render_class_from_type = {
    'image': {
        'static': ImageStaticShapeRenderer,
        'field': ImageFieldShapeRenderer,
    },
    'shape': {
        'static': ColorShapeRenderer,
    },
    'text': {
        'static': UserTextRenderer,
        'field': FieldTextRenderer
    },
}

text_option_fields = (
    'text_align',
    'text_align_vert',
    'text_font_size',
    'text_font',
    'text_color',
)

reset_dict_from_type = {
    'image': {
        'static': {field: False for field in ('field_path', 'text', 'color', *text_option_fields)},
        'field': {field: False for field in ('image', 'text', 'color', *text_option_fields)},
    },
    'shape': {
        'static': {field: False for field in ('field_path', 'text', 'image', *text_option_fields)},
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

    template_id = fields.Many2one('social.share.post.template', ondelete="cascade")
    model = fields.Char(related='template_id.model_id.model')

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

    # if any required element has no value to render, this element won't be rendered
    required_element_ids = fields.Many2many('social.share.image.render.element', relation="social_share_element_requirements", column1='social_share_element_required', column2='social_share_sub_element')
    sub_element_ids = fields.Many2many('social.share.image.render.element', relation="social_share_element_requirements", column1='social_share_sub_element', column2='social_share_element_required')

    _sql_constraints = [('role_uniq', "unique(template_id, role)", "Each template and post should only have one element for each role.")]

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

    def _get_renderer(self):
        renderer_class = self._get_renderer_class()
        renderer_values = self._get_renderer_constructor_values(renderer_class)
        return renderer_class(**renderer_values)

    def _get_renderer_constructor_values(self, renderer_class):
        """Return a dict containing kwargs to construct a renderer object."""
        common_dict = {
            'pos': (self.x_pos, self.y_pos),
            'size': (self.x_size, self.y_size),
        }
        if renderer_class == ImageStaticShapeRenderer:
            return common_dict | {
                'shape': self.shape,
                'image': self.image,
            }
        if renderer_class == ImageFieldShapeRenderer:
            return common_dict | {
                'shape': self.shape,
                'field_path': self.field_path,
            }
        if renderer_class == ColorShapeRenderer:
            return common_dict | {
                'shape': self.shape,
                'color': self.color
            }
        text_common_dict = {
            'text_align_horizontal': self.text_align,
            'text_align_vertical': self.text_align_vert,
            'text_color': self.text_color,
            'text_font_name': self.text_font,
            'text_font_size': self.text_font_size,
        }
        if renderer_class == UserTextRenderer:
            return common_dict | text_common_dict | {
                'text': self.text,
            }
        if renderer_class == FieldTextRenderer:
            return common_dict | text_common_dict | {
                'field_path': self.field_path,
                'model': self.model,
            }
        return dict()

    def _get_renderer_class(self):
        return render_class_from_type.get(self.type, {}).get(self.value_type)
