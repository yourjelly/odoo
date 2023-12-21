# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64

from odoo import _, api, Command, fields, models

SUPPORTED_ROLES = (
    'background', 'header', 'subheader',
    'section-1', 'subsection-1', 'subsection-2',
    'button', 'image-1', 'image-2'
)

class Post(models.Model):
    """
    This is used to send customized share links to event participants
    outlining their involvement in the event.
    """
    _name = 'social.share.post'
    _description = 'Social Share Campaign'

    def _get_text_types_selection(self):
        lambda self: self.env['social.share.image.render.element']._get_text_types()

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

    custom_element_ids = fields.One2many(
        'social.share.image.render.element',
        inverse_name='post_id',
        compute='_compute_custom_element_ids',
        readonly=False,
        store=True,
    )

    image = fields.Image(compute='_compute_image')

    @api.depends('share_template_variant_id')
    def _compute_custom_element_ids(self):
        for post in self:
            # identify changes
            template_custom_layers = post.share_template_variant_id.layers.filtered(lambda layer: layer.role in SUPPORTED_ROLES)
            current_custom_layers = post.custom_element_ids
            template_layer_roles = set(template_custom_layers.mapped('role'))
            current_layer_roles = set(current_custom_layers.mapped('role'))
            new_layer_ids = template_custom_layers.filtered(lambda layer: layer.role not in current_layer_roles)
            removed_layer_ids = current_custom_layers.filtered(lambda layer: layer.role not in template_layer_roles)

            # copy individually to copy translations too
            commands = [Command.unlink(id) for id in removed_layer_ids.ids]
            commands += [Command.create(layer.copy_data({'template_id': False})[0]) for layer in new_layer_ids]

            post.write({'custom_element_ids': commands})

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
            replacement_layers=self.custom_element_ids.grouped('role')
        )

    def _inverse_custom_elements(self):
        pass

    def action_send(self):
        pass
    def action_schedule(self):
        pass
    def action_test(self):
        pass
