# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, tools


class MailingFavorite(models.Model):
    """Allows the users to have favorites mailings."""
    _name = 'mailing.favorite'
    _description = 'Mailing Favorite'
    _order = 'create_date DESC'

    mailing_id = fields.Many2one('mailing.mailing', string='Mailing', ondelete='cascade')
    user_id = fields.Many2one('res.users', string='User', default=lambda self: self.env.user, ondelete='cascade')

    _sql_constraints = [(
        'unique_mailing_favorite',
        'UNIQUE(mailing_id, user_id)',
        'This mailing is already in the user favorites list.',
    )]

    @api.model
    def get_favorites(self):
        """Return all mailing set as favorite and skip mailing with empty body."""
        mailings = self.search([('user_id', '=', self.env.user.id)]).mapped('mailing_id')

        return [
            {
                'id': mailing.id,
                'subject': mailing.subject,
                'body_arch': mailing.body_arch,
            }
            for mailing in mailings
            if not tools.is_html_empty(mailing.body_arch)
        ]
