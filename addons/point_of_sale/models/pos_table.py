# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _, Command
from odoo.exceptions import UserError


class RestaurantTable(models.Model):

    _name = 'pos.table'
    _description = 'Restaurant Table'

    name = fields.Char('Table Name', required=True, help='An internal identification of a table')
    floor_id = fields.Many2one('pos.floor', string='Floor')
    shape = fields.Selection([('square', 'Square'), ('round', 'Round')], string='Shape', required=True, default='square')
    position_h = fields.Float('Horizontal Position', default=10,
        help="The table's horizontal position from the left side to the table's center, in pixels")
    position_v = fields.Float('Vertical Position', default=10,
        help="The table's vertical position from the top to the table's center, in pixels")
    width = fields.Float('Width', default=50, help="The table's width in pixels")
    height = fields.Float('Height', default=50, help="The table's height in pixels")
    seats = fields.Integer('Seats', default=1, help="The default number of customer served at this table.")
    color = fields.Char('Color', help="The table's color, expressed as a valid 'background' CSS property value", default="#35D374")
    active = fields.Boolean('Active', default=True, help='If false, the table is deactivated and will not be available in the point of sale')

    def are_orders_still_in_draft(self):
        draft_orders = self.env['pos.order'].search([('table_id', '=', self.id), ('state', '=', 'draft')])
        return len(draft_orders) > 0

    @api.ondelete(at_uninstall=False)
    def _unlink_except_active_pos_session(self):
        confs = self.mapped('floor_id.pos_config_ids').filtered(lambda c: c.module_pos_restaurant)
        opened_session = self.env['pos.session'].search([('config_id', 'in', confs.ids), ('state', '!=', 'closed')])
        if opened_session:
            error_msg = _("You cannot remove a table that is used in a PoS session, close the session(s) first.")
            if confs:
                raise UserError(error_msg)
