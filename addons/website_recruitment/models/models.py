# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from openerp import tools
from openerp import models, fields, api


class WebRecruitment(models.Model):
    _inherit = 'hr.job'
    
    user_id = fields.Many2one(default=lambda self: self.env.user.partner_id.id)
    skill_ids = fields.Many2many(
        'recruitment.skills', 'job_skill_rel', string="Skills")
    responsibilities = fields.Html(string="Responsibilities", required=True)
    must_have = fields.Html(string="Must Have", required=True)
    nice_to_have = fields.Html(string="Nice To Have")
    what_we_offer = fields.Html(string="What We Offer")

class RecruitmentSkills(models.Model):
	_name = 'recruitment.skills'

	name = fields.Char()

class ResPartner(models.Model):
    _inherit = "res.partner"

    auto_publish_job = fields.Boolean(string="Auto Publish Job")
    auto_publish_project = fields.Boolean(string="Auto Publish Project")
    verified = fields.Boolean()
    certified = fields.Boolean()
