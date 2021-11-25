# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class MassMailing(models.Model):
    _name = 'mailing.mailing'
    _inherit = 'mailing.mailing'

    @api.model
    def default_get(self, fields_list):
        vals = super(MassMailing, self).default_get(fields_list)
        context = self.env.context
        if context.get('active_model') == 'res.partner':
            vals['mailing_model_id'] = self.env['ir.model']._get(context.get('active_model')).id
            vals['mailing_domain'] = [('id', 'in', context.get('active_ids'))]
        return vals
