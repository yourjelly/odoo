# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class TimesheetPack(models.Model):
    _name = 'timesheet.pack'
    _description = 'Timesheet Pack'

    def _selection_res_model(self):
        selection_list = []
        for model_name in self.env.keys():
            if issubclass(type(self.env[model_name]), self.env.registry['timesheet.pack.mixin']):
                selection_list.append((model_name, self.env[model_name]._description))
        return selection_list

    name = fields.Char("Name")
    analytic_account_id = fields.Many2one('account.analytic.account', string="Analytic Account", copy=False, required=True)
    res_model = fields.Selection(selection='_selection_res_model', string="Related Document Model", copy=False)
    res_id = fields.Integer("Related Document Id")
    timesheet_ids = fields.One2many('account.analytic.line', 'timesheet_pack_id', string="Analytic Lines")

    # TODO JEM: maybe a unique(res_model,res_id) to ensure only one implementation for this service pack

    @api.multi
    def name_get(self):
        result = []
        for pack in self:
            result.append((pack.id, "%s (%s)" % (pack.name, pack.res_model)))
        return result
