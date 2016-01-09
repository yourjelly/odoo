# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from openerp import api, fields, models, _

class HelpdeskTicket(models.Model):
    _inherit = "helpdesk.ticket"

    forum_post_id = fields.Many2one('forum.post', string="Forum Post")
    feature_helpcenter = fields.Boolean(related='team_id.feature_helpcenter', string='Help Center Active')

    @api.multi
    def forum_post_new(self):
        self.ensure_one()
        if not self.team_id.feature_helpcenter_id:
            raise UserError(_('Help Center not active for this team.'))
        post = self.env['forum.post'].create({
            'name': self.name,
            'forum_id': self.team_id.feature_helpcenter_id.id,
            'content': '',
            'post_type': 'question',
        })
        self.forum_post_id = post.id
        return self.forum_post_open()

    @api.multi
    def forum_post_open(self):
        self.ensure_one()
        if not self.team_id.feature_helpcenter_id:
            raise UserError(_('Help Center not active for this team.'))
        if not self.forum_post_id:
            raise UserError(_('No post associated to this ticket.'))
        return {
            'type': 'ir.actions.act_url',
            'url': '/forum/'+str(self.team_id.feature_helpcenter_id.id)+'/question/'+str(self.forum_post_id.id),
            'target': 'self',
        }


class HelpdeskTeam(models.Model):
    _inherit = "helpdesk.team"

    feature_helpcenter_id = fields.Many2one('forum.forum', 'Help Center Forum')
    feature_helpcenter_url = fields.Char('Help Center URL', readonly=True, compute='_get_helpcenter', store=True)
    feature_helpcenter = fields.Boolean('Help Center', compute='_get_helpcenter', inverse='_set_feature_helpcenter', store=True)

    feature_elearning_id = fields.Many2one('slide.Channel', 'eLearning')
    feature_elearning_url = fields.Char('Presentations URL', readonly=True, compute='_get_elearning', store=True)
    feature_elearning = fields.Boolean('eLearning', compute='_get_elearning', inverse='_set_feature_elearning', store=True)

    # Feature Fields Compute
    @api.one
    @api.depends('feature_helpcenter_id')
    def _get_helpcenter(self):
        self.feature_helpcenter = bool(self.feature_helpcenter_id)
        self.feature_helpcenter_url = (self.feature_helpcenter_id and self.id) and ('/website/helpdesk/'+str(self.id)) or False

    @api.one
    def _set_feature_helpcenter(self):
        if self.feature_helpcenter:
            forum = self.env['forum.forum'].create({
                'name': self.name,
                'default_order': 'vote_count desc',
                'default_post_type': 'question',
                'allow_question': True,
                'allow_discussion': False,
                'allow_link': False,
                'allow_bump': False,
                'allow_share': False,
                'karma_ask': 0,
            })
            self.feature_helpcenter_id = forum.id
        else:
            self.feature_helpcenter_id = False

    @api.one
    @api.depends('feature_elearning_id')
    def _get_elearning(self):
        self.feature_elearning = bool(self.feature_elearning_id)
        self.feature_elearning_url = (self.feature_elearning_id and self.id) and ('/website/helpdesk/'+str(self.id)) or False

    @api.one
    def _set_feature_elearning(self):
        if self.feature_elearning:
            slide = self.env['slide.channel'].create({
                'name': self.name,
                'promote_strategy': 'most_viewed',
                'website_published': True,
            })
            self.feature_elearning_id = slide.id
        else:
            self.feature_elearning_id = False

