# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64

from odoo import _, api, Command, fields, models
from .renderer_text import FieldTextRenderer, UserTextRenderer
from .renderer_image import ColorShapeRenderer, ImageShapeRenderer

SUPPORTED_ROLES = (
    'background', 'header', 'subheader',
    'section-1', 'subsection-1', 'subsection-2',
    'button', 'image-1', 'image-2'
)

VALUE_TYPES = [('static', 'Text'), ('field', 'Field')]

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
        layers = self.share_template_variant_id.layers.filtered('role')
        layer_values = {
            layer.role: render_values
            for layer, (_, render_values)
            in zip(layers, layers._get_renderer_values())
        }
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
            'subsection-1': (FieldTextRenderer if self.subsection_1_type == 'field' else UserTextRenderer,{
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
            role: post_values[role][0](**(layer_values[role] | post_values[role][1]))
            for role in layer_values.keys() & post_values.keys()
        }


    def _inverse_custom_elements(self):
        pass

    def action_send(self):
        pass
    def action_schedule(self):
        pass
    def action_test(self):
        pass
