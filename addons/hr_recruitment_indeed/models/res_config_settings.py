# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class ResConfigSettings(models.TransientModel):
    _inherit = ['res.config.settings']

    indeed_api_token = fields.Char(compute="_compute_indeed_api_token", inverse="_inverse_indeed_api_token")
    indeed_secret_key = fields.Char(compute="_compute_indeed_secret_key", inverse="_inverse_indeed_secret_key")

    @api.depends('module_hr_recruitment_indeed')
    def _compute_indeed_api_token(self):
        indeed_api_token = self.env['ir.config_parameter'].sudo().get_param('hr_recruitment_indeed.indeed_api_token')
        for setting in self:
            setting.indeed_api_token = indeed_api_token

    def _inverse_indeed_api_token(self):
        for setting in self:
            self.env['ir.config_parameter'].sudo().set_param('hr_recruitment_indeed.indeed_api_token', setting.indeed_api_token)

    @api.depends('module_hr_recruitment_indeed')
    def _compute_indeed_secret_key(self):
        indeed_secret_key = self.env['ir.config_parameter'].sudo().get_param('hr_recruitment_indeed.indeed_secret_key')
        for setting in self:
            setting.indeed_secret_key = indeed_secret_key

    def _inverse_indeed_secret_key(self):
        for setting in self:
            self.env['ir.config_parameter'].sudo().set_param('hr_recruitment_indeed.indeed_secret_key', setting.indeed_secret_key)
