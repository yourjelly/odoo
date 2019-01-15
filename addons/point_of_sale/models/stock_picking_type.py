# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
# Copyright (C) 2004-2008 PC Solutions (<http://pcsol.be>). All Rights Reserved
from odoo import fields, models, api, _
from odoo.exceptions import UserError


class StockPickingType(models.Model):
    _inherit = 'stock.picking.type'

    @api.multi
    def unlink(self):
        for picking_type in self:
            pos_session_ids = self.env['pos.session'].search([('config_id.picking_type_id', '=', picking_type.id), ('state', '!=', 'closed')]).ids
            if len(pos_session_ids):
                raise UserError(_("You cannot delete Picking Types that are used by active PoS sessions.\n")\
                        + _("Picking Type: ") + str(picking_type.id) + "\n"\
                        + _("PoS Sessions: ") + ", ".join(str(pos_session_id) for pos_session_id in pos_session_ids))
        return super(StockPickingType, self).unlink()
