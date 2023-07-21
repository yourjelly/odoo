# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class ResConfigSettings(models.TransientModel):
    _inherit = ['res.config.settings']

    module_website_hr_recruitment = fields.Boolean(string='Online Posting')
    module_hr_recruitment_survey = fields.Boolean(string='Interview Forms')
    group_applicant_cv_display = fields.Boolean(implied_group="hr_recruitment.group_applicant_cv_display")
    module_hr_recruitment_extract = fields.Boolean(string='Send CV to OCR to fill applications')

    link_indeed_account = fields.Boolean(string="Indeed account", config_parameter="hr_recruitment.link_indeed_account")
    indeed_api_token = fields.Char(compute="_compute_indeed_api_token",inverse="_inverse_indeed_api_token")
    indeed_post_url = fields.Char(compute="_compute_indeed_post_url",inverse="_inverse_indeed_post_url")
    @api.onchange('link_indeed_account')
    def _onchange_indeed_account(self):
        if not self.link_indeed_account:
            self.indeed_api_token = None
            self.indeed_post_url = None
    @api.depends('link_indeed_account')
    def _compute_indeed_api_token(self):
        indeed_api_token = self.env['ir.config_parameter'].sudo().get_param('hr_recruitment.indeed_api_token')
        for setting in self:
            setting.indeed_api_token = indeed_api_token
    def _inverse_indeed_api_token(self):
        for setting in self:
            self.env['ir.config_parameter'].sudo().set_param('hr_recruitment.indeed_api_token', setting.indeed_api_token)

    @api.depends('link_indeed_account')
    def _compute_indeed_post_url(self):
        indeed_post_url = self.env['ir.config_parameter'].sudo().get_param('hr_recruitment.indeed_post_url')
        for setting in self:
            setting.indeed_post_url = indeed_post_url

    def _inverse_indeed_post_url(self):
        for setting in self:
            self.env['ir.config_parameter'].sudo().set_param('hr_recruitment.indeed_post_url', setting.indeed_post_url)
