# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, tools, _


class IRFTSDocuemnts(models.Model):
    _name = 'ir.fts_documents'
    _description = 'FTS Documents'
    _rec_name = 'res_name'

    @api.one
    @api.depends('model_name','res_id')
    def _compute_res_name(self):
        self.res_name = self.env[self.model_name].browse(self.res_id).name

    res_name = fields.Char(string="Resource Name", compute='_compute_res_name', store=True, help="The name of the resource.")
    model_name = fields.Char('Model', required=True)
    res_id = fields.Integer(string='Resource ID', required=True)
    fts_document = fields.Text(string='FTS Document', required=True, index=True)
    
