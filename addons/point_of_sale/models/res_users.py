# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, models, _
from odoo.exceptions import UserError


class ResUsers(models.Model):
    _inherit = 'res.users'

    @api.multi
    def unlink(self):
        for user in self:
            if (self.env['pos.session'].search_count([('user_id', '=', user.id), ('state', '!=', 'closed')]) 
                    or user.has_group('point_of_sale.group_pos_user') or user.has_group('point_of_sale.group_pos_user')):
                raise UserError(_("You cannot delete Users that could be in use by active PoS sessions."))
        return super(ResUsers, self).unlink()
