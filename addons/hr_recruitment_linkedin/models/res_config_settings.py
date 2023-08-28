# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    linkedin_api_token = fields.Char(compute="_compute_linkedin_api_token", inverse="_inverse_linkedin_api_token")
    linkedin_secret_key = fields.Char(compute="_compute_linkedin_secret_key", inverse="_inverse_linkedin_secret_key")

    @api.depends('module_hr_recruitment_linkedin')
    def _compute_linkedin_api_token(self):
        linkedin_api_token = self.env['ir.config_parameter'].sudo().get_param('hr_recruitment_linkedin.linkedin_api_token')
        for setting in self:
            setting.linkedin_api_token = linkedin_api_token

    def _inverse_linkedin_api_token(self):
        for setting in self:
            self.env['ir.config_parameter'].sudo().set_param('hr_recruitment_linkedin.linkedin_api_token', setting.linkedin_api_token)

    @api.depends('module_hr_recruitment_linkedin')
    def _compute_linkedin_secret_key(self):
        linkedin_secret_key = self.env['ir.config_parameter'].sudo().get_param('hr_recruitment_linkedin.linkedin_secret_key')
        for setting in self:
            setting.linkedin_secret_key = linkedin_secret_key

    def _inverse_linkedin_secret_key(self):
        for setting in self:
            self.env['ir.config_parameter'].sudo().set_param('hr_recruitment_linkedin.linkedin_secret_key', setting.linkedin_secret_key)