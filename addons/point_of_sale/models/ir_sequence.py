# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
# Copyright (C) 2004-2008 PC Solutions (<http://pcsol.be>). All Rights Reserved
from odoo import models, api, _
from odoo.exceptions import UserError


class IrSequence(models.Model):
    _inherit = 'ir.sequence'

    @api.multi
    def write(self, vals):
        for sequence in self:
            pos_session_ids = self.env['pos.session'].search([('config_id.sequence_id', '=', sequence.id), ('state', '!=', 'closed')]).ids
            if vals.get('active', False) and len(pos_session_ids):
                raise UserError(_("You cannot archive Sequences that are used by active PoS sessions.\n")\
                        + _("Sequence: ") + str(sequence.id) + "\n"\
                        + _("PoS Sessions") + ', '.join(str(pos_session_id) for pos_session_id in pos_session_ids))
        return super(IrSequence, self).write(vals)

    @api.multi
    def unlink(self):
        for sequence in self:
            pos_session_ids = self.env['pos.session'].search([('config_id.sequence_id', '=', sequence.id), ('state', '!=', 'closed')]).ids
            if len(pos_session_ids):
                raise UserError(_("You cannot delete Sequences that are used by active PoS sessions.\n")\
                        + _("Sequence: ") + str(sequence.id) + "\n"\
                        + _("PoS Sessions") + ', '.join(str(pos_session_id) for pos_session_id in pos_session_ids))

        return super(IrSequence, self).unlink()
