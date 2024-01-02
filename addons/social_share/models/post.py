# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64

from odoo import _, api, Command, fields, models

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

    header_type = fields.Selection(selection=VALUE_TYPES)
    subheader_type = fields.Selection(selection=VALUE_TYPES)
    section_1_type = fields.Selection(selection=VALUE_TYPES)
    subsection_1_type = fields.Selection(selection=VALUE_TYPES)
    subsection_2_type = fields.Selection(selection=VALUE_TYPES)

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

    @api.depends('custom_element_ids.image')
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
            replacement_values=self._get_replacement_values()
        )

    def _get_replacement_values(self):
        return {
            'background': {
                'type': 'image',
                'value_type': 'static',
                'image': self.background_val,
            },
            'header': {
                'type': 'text',
                'value_type': self.header_type,
                'field_path': self.header_val,
                'text': self.header_val,
            },
            'subheader': {
                'type': 'text',
                'value_type': self.subheader_type,
                'field_path': self.subheader_val,
                'text': self.subheader_val,
            },
            'section-1': {
                'type': 'text',
                'value_type': self.section_1_type,
                'field_path': self.section_1_val,
                'text': self.section_1_val,
            },
            'subsection-1': {
                'type': 'text',
                'value_type': self.subsection_1_type,
                'field_path': self.subsection_1_val,
                'text': self.subsection_1_val,
            },
            'subsection-2': {
                'type': 'text',
                'value_type': self.subsection_2_type,
                'field_path': self.subsection_2_val,
                'text': self.subsection_2_val,
            },
            'button': {
                'type': 'text',
                'value_type': 'static',
                'text': self.button_val,
            },
            'image-1': {
                'type': 'image',
                'value_type': 'static',
                'image': self.image_1_val,
            },
            'image-2': {
                'type': 'image',
                'value_type': 'static',
                'image': self.image_2_val,
            },
        }


    def _inverse_custom_elements(self):
        pass

    def action_send(self):
        pass
    def action_schedule(self):
        pass
    def action_test(self):
        pass
