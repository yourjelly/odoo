# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _, Command
from odoo.exceptions import UserError


class RestaurantFloor(models.Model):

    _name = 'pos.floor'
    _description = 'Restaurant Floor'
    _order = "sequence, name"

    name = fields.Char('Floor Name', required=True)
    pos_config_ids = fields.Many2many('pos.config', string='Point of Sales', domain="[('module_pos_restaurant', '=', True)]")
    background_image = fields.Binary('Background Image')
    background_color = fields.Char('Background Color', help='The background color of the floor in a html-compatible format', default='rgb(210, 210, 210)')
    table_ids = fields.One2many('pos.table', 'floor_id', string='Tables')
    sequence = fields.Integer('Sequence', default=1)
    active = fields.Boolean(default=True)

    @api.ondelete(at_uninstall=False)
    def _unlink_except_active_pos_session(self):
        confs = self.mapped('pos_config_ids').filtered(lambda c: c.module_pos_restaurant)
        opened_session = self.env['pos.session'].search([('config_id', 'in', confs.ids), ('state', '!=', 'closed')])
        if opened_session:
            error_msg = _("You cannot remove a floor that is used in a PoS session, close the session(s) first: \n")
            for floor in self:
                for session in opened_session:
                    if floor in session.config_id.floor_ids:
                        error_msg += _("Floor: %s - PoS Config: %s \n") % (floor.name, session.config_id.name)
            if confs:
                raise UserError(error_msg)

    def write(self, vals):
        for floor in self:
            for config in floor.pos_config_ids:
                if config.has_active_session and (vals.get('pos_config_ids') or vals.get('active')):
                    raise UserError(
                        'Please close and validate the following open PoS Session before modifying this floor.\n'
                        'Open session: %s' % (' '.join(config.mapped('name')),))
        return super(RestaurantFloor, self).write(vals)

    def rename_floor(self, new_name):
        for floor in self:
            floor.name = new_name

    @api.model
    def create_from_ui(self, name, background_color, config_id):
        floor_fields = {
            "name": name,
            "background_color": background_color,
        }
        pos_floor = self.create(floor_fields)
        pos_floor.pos_config_ids = [Command.link(config_id)]
        return {
            'id': pos_floor.id,
            'name': pos_floor.name,
            'background_color': pos_floor.background_color,
            'table_ids': [],
            'sequence': pos_floor.sequence,
            'tables': [],
        }

    def deactivate_floor(self, session_id):
        draft_orders = self.env['pos.order'].search([('session_id', '=', session_id), ('state', '=', 'draft'), ('table_id.floor_id', '=', self.id)])
        if draft_orders:
            raise UserError(_("You cannot delete a floor when orders are still in draft for this floor."))
        for table in self.table_ids:
            table.active = False
        self.active = False
