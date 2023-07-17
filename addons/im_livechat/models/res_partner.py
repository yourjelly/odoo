# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields


class Partners(models.Model):
    """Update of res.partner class to take into account the livechat username."""
    _inherit = 'res.partner'

    user_livechat_username = fields.Char(compute='_compute_user_livechat_username')

    @api.model
    def search_for_channel_invite(self, search_term, channel_id=None, limit=30):
        result = super().search_for_channel_invite(search_term, channel_id, limit)
        channel = self.env['discuss.channel'].browse(channel_id)
        partners = self.browse([partner["id"] for partner in result['partners']])
        if channel.channel_type != 'livechat' or not partners:
            return result
        lang_name_by_code = {code: name for code, name in self.env['res.lang'].get_installed()}
        formatted_partner_by_id = {formatted_partner['id']: formatted_partner for formatted_partner in result['partners']}
        self.env.cr.execute("""
            SELECT partner_id, COUNT(*)
            FROM discuss_channel_member
            WHERE partner_id IN %s
            AND create_uid = %s
            GROUP BY partner_id
        """, (tuple(partners.ids), self.env.user.id))
        invite_count_by_partner_id = {partner_id: count for partner_id, count in self.env.cr.fetchall()}
        active_livechat_partner_id = self.env['im_livechat.channel'].search([]).mapped('available_operator_ids.partner_id.id')
        for partner in partners:
            formatted_partner_by_id[partner.id].update({
                'lang_name': lang_name_by_code[partner.lang],
                'invite_count': invite_count_by_partner_id.get(partner.id, 0),
                'is_available': partner.id in active_livechat_partner_id,
            })
        return result

    def _get_channels_as_member(self):
        channels = super()._get_channels_as_member()
        channels |= self.env['discuss.channel'].search([
            ('channel_type', '=', 'livechat'),
            ('channel_member_ids', 'in', self.env['discuss.channel.member'].sudo()._search([
                ('partner_id', '=', self.id),
                ('is_pinned', '=', True),
            ])),
        ])
        return channels

    @api.depends('user_ids.livechat_username')
    def _compute_user_livechat_username(self):
        for partner in self:
            partner.user_livechat_username = next(iter(partner.user_ids.mapped('livechat_username')), False)
