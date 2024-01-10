# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64

from odoo import _, api, exceptions, fields, models
from .renderer_text import FieldTextRenderer, UserTextRenderer
from .renderer_image import ImageShapeRenderer

VALUE_TYPES = [('static', 'Text'), ('field', 'Field')]

# roles that are linked to post fields and what type of values they should be
SUPPORTED_ROLES = {
    'background': {'type': ['image', 'shape'], 'value_type': ['static']},
    'header': {'type': ['text'], 'value_type': [t[0] for t in VALUE_TYPES]},
    'subheader': {'type': ['text'], 'value_type': [t[0] for t in VALUE_TYPES]},
    'section-1': {'type': ['text'], 'value_type': [t[0] for t in VALUE_TYPES]},
    'subsection-1': {'type': ['text'], 'value_type': [t[0] for t in VALUE_TYPES]},
    'subsection-2': {'type': ['text'], 'value_type': [t[0] for t in VALUE_TYPES]},
    'button': {'type': ['text'], 'value_type': ['static']},
    'image-1': {'type': ['image', 'shape'], 'value_type': ['static']},
    'image-2': {'type': ['image', 'shape'], 'value_type': ['static']},
}


class Post(models.Model):
    """
    This is used to send customized share links to event participants
    outlining their involvement in the event.
    """
    _name = 'social.share.post'
    _description = 'Social Share Campaign'

    name = fields.Char(required=True)
    active = fields.Boolean(default=True)
    model_id = fields.Many2one('ir.model', domain=lambda self: [('model', 'in', self.env['social.share.post.template']._get_valid_target_models())])
    model = fields.Char(related='model_id.model', string="Model Name")
    reference_share_template_id = fields.Many2one(
        'social.share.post.template', 'Reference Template',
        domain="[('parent_variant_id', '=', False),"
        "'|', ('model_id', '=', False), ('model_id', '=', model_id)]"
    )
    share_template_variant_id = fields.Many2one(
        'social.share.post.template', domain="['|', ('id', '=', reference_share_template_id),"
        "('parent_variant_id', '=', reference_share_template_id)]"
    )

    post_suggestion = fields.Text()
    tag_ids = fields.Many2many('social.share.tag', string='Tags')
    target_url = fields.Char(string='Target URL', required=True)
    thanks_message = fields.Html(string='Thank-You Message')
    thanks_redirection = fields.Char(string='Redirection URL')
    user_id = fields.Many2one('res.users', string='Responsible', default=lambda self: self.env.user)

    header_type = fields.Selection(selection=VALUE_TYPES, default='static', required=True)
    subheader_type = fields.Selection(selection=VALUE_TYPES, default='static', required=True)
    section_1_type = fields.Selection(selection=VALUE_TYPES, default='static', required=True)
    subsection_1_type = fields.Selection(selection=VALUE_TYPES, default='static', required=True)
    subsection_2_type = fields.Selection(selection=VALUE_TYPES, default='static', required=True)

    header_val = fields.Text()
    subheader_val = fields.Text()
    section_1_val = fields.Text()
    subsection_1_val = fields.Text()
    subsection_2_val = fields.Text()

    background_val = fields.Image()
    button_val = fields.Text()
    image_1_val = fields.Image()
    image_2_val = fields.Image()

    image = fields.Image(compute='_compute_image')

    @api.constrains('share_template_variant_id.layers.type', 'share_template_variant_id.layers.value_type')
    def _check_share_template_variant_id(self):
        for post in self:
            for layer in post.reference_share_template_id.layers.filtered('role'):
                if not self._check_layer_is_compatible(layer):
                    raise exceptions.ValidationError(_('%(layer_role)s is used in %(social_campaign_name)s but has incompatible values.'))

    @staticmethod
    def _check_layer_is_compatible(layer):
        expected_values = SUPPORTED_ROLES.get(layer.role, dict())
        for field, valid_values in expected_values.items():
            if layer[field] not in valid_values:
                return False
        return True

    @api.onchange('reference_share_template_id')
    def _onchange_reference_share_template_id(self):
        for post in self:
            type_fields = (field for field in ('header', 'subheader', 'section_1', 'subsection_1', 'subsection_2') if not post[f'{field}_val'])
            fixed_fields = (field for field in (('background', 'image'), ('button', 'text'), ('image_1', 'image'), ('image_2', 'image')) if not post[f'{field[0]}_val'])
            if not type_fields and not fixed_fields:
                continue
            layers = post.reference_share_template_id.layers.filtered('role').grouped('role')
            for type_field in type_fields:
                related_role = type_field.replace('_', '-')
                if related_layer := layers.get(related_role):
                    layer_value = related_layer.text if related_layer.value_type == 'static' else related_layer.field_path
                    setattr(self, f'{type_field}_type', related_layer.value_type)
                    setattr(self, f'{type_field}_val', layer_value)

            for fixed_field, layer_value_field in fixed_fields:
                related_role = fixed_field.replace('_', '-')
                if related_layer := layers.get(related_role):
                    layer_value = related_layer[layer_value_field]
                    setattr(self, f'{fixed_field}_val', layer_value)

    @api.model
    def _get_image_dependency_fields(self):
        return (
            'share_template_variant_id.layers',
            'header_type',
            'subheader_type',
            'section_1_type',
            'subsection_1_type',
            'subsection_2_type',
            'header_val',
            'subheader_val',
            'section_1_val',
            'subsection_1_val',
            'subsection_2_val',
            'background_val',
            'button_val',
            'image_1_val',
            'image_2_val',
        )

    @api.depends(lambda self: self._get_image_dependency_fields())
    def _compute_image(self):
        for post in self:
            post.image = base64.encodebytes(post._generate_image_bytes())

    def action_open_url_share(self):
        """Open url dialog."""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Url Share'),
            'res_model': 'social.share.url.share',
            'views': [[False, 'form']],
            'context': {
                'default_campaign_id': self.id,
                'dialog_size': 'medium',
            },
            'target': 'new',
        }

    def _generate_image_bytes(self, record=None):
        return self.share_template_variant_id._generate_image_bytes(
            record=record,
            replacement_renderers=self._get_replacement_renderers()
        )

    def _get_replacement_renderers(self):
        """Combine the original values of the template with the custom values of the post.

        Get a mapping from layer role to an instance of a renderer.
        """
        layers = self.share_template_variant_id.layers.filtered('role').grouped('role')
        model = self.env[self.model] if self.model else None
        post_values = {
            role: (renderer, values) for role, (renderer, values, has_value)
            in {
                'background': (ImageShapeRenderer, {'image': self.background_val}, self.background_val),
                'button': (UserTextRenderer, {'text': self.button_val}, self.button_val),
                'image-1': (ImageShapeRenderer, {'image': self.image_1_val}, self.image_1_val),
                'image-2': (ImageShapeRenderer, {'image': self.image_2_val}, self.image_2_val),
                'header': (FieldTextRenderer if self.header_type == 'field' else UserTextRenderer, {
                    'field_path': self.header_val,
                    'model': model,
                    'text': self.header_val,
                }, self.header_val),
                'subheader': (FieldTextRenderer if self.subheader_type == 'field' else UserTextRenderer, {
                    'field_path': self.subheader_val,
                    'model': model,
                    'text': self.subheader_val,
                }, self.subheader_val),
                'section-1': (FieldTextRenderer if self.section_1_type == 'field' else UserTextRenderer, {
                    'field_path': self.section_1_val,
                    'model': model,
                    'text': self.section_1_val,
                }, self.section_1_val),
                'subsection-1': (FieldTextRenderer if self.subsection_1_type == 'field' else UserTextRenderer, {
                    'field_path': self.subsection_1_val,
                    'model': model,
                    'text': self.subsection_1_val,
                }, self.subsection_1_val),
                'subsection-2': (FieldTextRenderer if self.subsection_2_type == 'field' else UserTextRenderer, {
                    'field_path': self.subsection_2_val,
                    'model': model,
                    'text': self.subsection_2_val,
                }, self.subsection_2_val),
            }.items()
            if has_value
        }
        return {
            role: post_values[role][0](**(
                layers[role]._get_renderer_constructor_values(post_values[role][0]) | post_values[role][1]
            ))
            for role in layers.keys() & post_values.keys()
        }


    def _inverse_custom_elements(self):
        pass

    def action_send(self):
        pass
    def action_schedule(self):
        pass
    def action_test(self):
        pass
