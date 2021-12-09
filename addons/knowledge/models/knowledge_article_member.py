# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import hashlib

from odoo import fields, models, api, _
from odoo.exceptions import ValidationError


class ArticleMember(models.Model):
    _name = 'knowledge.article.member'
    _description = 'Article Members'
    _table = 'knowledge_article_member'
    _rec_name = 'partner_id'

    def init(self):
        self._cr.execute("""SELECT indexname FROM pg_indexes 
                            WHERE indexname = 'knowledge_article_member_article_partner_idx'""")
        if not self._cr.fetchone():
            self._cr.execute("""CREATE INDEX knowledge_article_member_article_partner_idx 
                                ON knowledge_article_member (article_id, partner_id)""")

    article_id = fields.Many2one('knowledge.article', 'Article', ondelete='cascade', required=True)
    partner_id = fields.Many2one('res.partner', 'Partner', index=True, ondelete='cascade', required=True)
    permission = fields.Selection([
        ('none', 'None'),
        ('read', 'Read'),
        ('write', 'Write'),
    ], required=True, default='read')
    article_permission = fields.Selection(related='article_id.inherited_permission')

    _sql_constraints = [
        ('partner_unique', 'unique(article_id, partner_id)', 'You already added this partner in this article.')
    ]

    @api.constrains('article_permission', 'permission')
    def _check_members(self):
        """
        An article should always be available for update (aka: inherit write permission, or a member with write access).
        Since this constraint only triggers if we have at least one member on the article, another validation is done in
        'knowledge.article' model. The article_permission related field has been added and stored to force triggering
        this constraint when article.permission is modified.
        """
        members_tocheck = self.filtered(lambda member: member.article_permission != 'write')
        if not members_tocheck:
            return

        parent_members_permission = members_tocheck.article_id.parent_id._get_article_member_permissions()
        for member in members_tocheck:
            # check on current member article
            article_write_members = member.article_id.article_member_ids.filtered(
                    lambda member: member.permission == 'write')
            if len(article_write_members) > 0:
                continue
            # check on parents members
            parent_write_members = any(
                values['permission'] == 'write' for partner_id, values
                in parent_members_permission[member.article_id.parent_id.id].items()
                if not member.article_id.is_desynchronized
                and partner_id not in member.article_id.article_member_ids.mapped('partner_id').ids
            )
            if not parent_write_members:
                raise ValidationError(_("An article should always be available for update: inherit write permission, or have a member with write access)"))

    @api.constrains('partner_id', 'permission')
    def _check_external_member_permission(self):
        for member in self:
            if member.partner_id.partner_share and member.permission == 'write':
                raise ValidationError(_('An external user cannot have a "write" permission'))

    @api.ondelete(at_uninstall=False)
    def _unlink_except_no_writer(self):
        """ When removing a member, the constraint is not triggered.
        We need to check manually on article with no write permission that we do not remove the last write member """
        articles = self.article_id
        members_by_articles = dict.fromkeys(self.article_id.ids, self.env['knowledge.article.member'])
        articles_permission = articles._get_internal_permission(article_ids=articles.ids)
        for member in self:
            members_by_articles[member.article_id.id] |= member
        for article in articles:
            if articles_permission.get(article.id) == 'write':
                continue
            remaining_members = article.article_member_ids - members_by_articles[article.id]
            if not remaining_members.filtered(lambda m: m.permission == 'write'):
                raise ValidationError(_("You must have at least one writer."))

    def _get_invitation_hash(self):
        """ We use a method instead of a field in order to reduce DB space."""
        self.ensure_one()
        return hashlib.sha1(
            (
                str(self.id)
                + fields.Date.to_string(self.create_date)
                + str(self.partner_id)
                + str(self.article_id)
            ).encode("utf-8")
        ).hexdigest()
