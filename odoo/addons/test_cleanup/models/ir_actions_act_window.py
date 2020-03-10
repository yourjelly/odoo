# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, _

class IrActionsActWindow(models.Model):
    _inherit = 'ir.actions.act_window'

    @api.model
    def _get_unused_actions(self):
        # context key to ensure invisible menus are not filtered.
        self = self.with_context({'ir.ui.menu.full_list': True}).sudo()
        Actions = self.env['ir.actions.act_window']
        Views = self.env['ir.ui.view']
        menus = self.env['ir.ui.menu'].search([])
        menus_actions = Actions
        for menu in menus:
            if menu.action and menu.action._name == 'ir.actions.act_window':
                menus_actions += menu.action

        maybe_unused_actions = Actions.search([('id', 'not in', menus_actions.ids)])
        for action in maybe_unused_actions:
            # Catch all buttons with name="%(xml_id)"
            target_string = 'name="%i"' % action.id
            kanban_on_create = 'on_create="%s"' % action.xml_id
            kanban_on_create_bis = 'on_create="%s"' % action.xml_id.split('.')[1]
            if Views.search([
                '|', '|',
                ('arch_db', 'ilike', target_string),
                ('arch_db', 'ilike', kanban_on_create),
                ('arch_db', 'ilike', kanban_on_create_bis)
                ]):
                maybe_unused_actions -= action
            elif action.binding_model_id:
                maybe_unused_actions -= action

        return maybe_unused_actions
