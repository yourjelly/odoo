# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models


class Post(models.Model):
    """
    This is used to send customized share links to event participants
    outlining their involvment in the event.
    """
    _name = 'social.share.post'

    name = fields.Char(required=True)
    active = fields.Boolean(default=True)
    model_id = fields.Many2one('ir.model', domain=lambda self: [('model', 'in', self.env['social.share.post.template']._get_valid_target_models())])
    reference_share_template_id = fields.Many2one(
        'social.share.post.template', 'Reference Template',
        domain=lambda self: [('post_id', '=', False), ('parent_id', '=', False), '|', ('model_id', '=', False), ('model_id', '=', self.model_id)])
    share_template_id = fields.Many2one(
        'social.share.post.template', compute='_compute_share_template_id',
        domain=lambda self: [('post_id', '=', self.id), ('parent_id', '=', self.reference_share_template_id.id if self.reference_share_template_id else False)],
        store=True, readonly=False)
    suggested_text = fields.Text()
    tag_ids = fields.Many2many('social.share.tag')
    target_url = fields.Char(required=True)
    user_id = fields.Many2one('res.users', default=lambda self: self.env.user)

    background = fields.Image(related='share_template_id.background')
    header = fields.Many2one(related='share_template_id.header')
    subheader = fields.Many2one(related='share_template_id.subheader')
    sharer_name = fields.Many2one(related='share_template_id.sharer_name')
    sharer_position = fields.Many2one(related='share_template_id.sharer_position')
    sharer_company = fields.Many2one(related='share_template_id.sharer_company')
    button = fields.Many2one(related='share_template_id.button')
    profile_image = fields.Many2one(related='share_template_id.profile_image')
    logo = fields.Many2one(related='share_template_id.logo')

    image = fields.Image(related='share_template_id.image')

    @api.depends('reference_share_template_id')
    def _compute_share_template_id(self):
        with_reference = self.filtered('reference_share_template_id')
        (self - with_reference).share_template_id = False
        for post in with_reference:
            reference_copy = post.reference_share_template_id.copy({
                'parent_id': post.reference_share_template_id.id
            })
            post.share_template_id = reference_copy

    @api.depends('share_template_id')
    def _compute_body(self):
        for campaign in self:
            campaign.body = campaign.share_template_id.content

    def action_send(self):
        pass
    def action_schedule(self):
        pass
    def action_test(self):
        pass
