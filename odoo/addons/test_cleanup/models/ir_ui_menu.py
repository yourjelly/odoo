# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, tools, _
import logging
_logger = logging.getLogger(__name__)


class IrUiMenu(models.Model):
    _inherit = 'ir.ui.menu'

    def _log_unused_groups(self):
        all_menus = self.env['ir.ui.menu'].sudo().search([])
        for menu in all_menus:
            children_with_same_group = menu.child_id.filtered(lambda child: child.groups_id == menu.groups_ids)
            _logger.warning("Childs %s of menu %s have same groups %s",
                children_with_same_group.mapped('name'),
                menu.name, menu.groups_ids.mapped('name'))

        # Idea : warn menus with only one child bc useless nesting ?
