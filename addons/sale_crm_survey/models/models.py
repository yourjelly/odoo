# -*- coding: utf-8 -*-

from odoo import models, fields, api
from odoo.addons.crm.models import crm_stage


# /home/odoo/odoo/community/addons/crm/models/crm_stage
class sale_crm_survey(models.Model):
    _inherit = 'sale.order.template'

    self_mode = fields.Boolean()
    survey_id = fields.Many2one('survey.survey', string="Survey")
    rule_ids = fields.One2many('sale_crm_survey.rules', 'template_id', string="Rules")
    confirmation = fields.Selection([('confirm_order', 'Confirm Order'), ('opportunity', 'Opportunity')])
    # confirm_order = fields.Boolean()
    user_id = fields.Many2one('res.users', string="Sale Person")
    team_id = fields.Many2one('crm.team', string="Sale Team")
    # name = fields.Char(string="Name")
    type = fields.Selection([('lead', 'Lead'), ('opportunity', 'Opportunity')])
    tag_ids = fields.Many2many('crm.lead.tag', string="Tags")
    priority = fields.Selection(crm_stage.AVAILABLE_PRIORITIES)
    # user_input = fields.Many2one('survey.user_input', string="User Input")
    # quotation = fields.Boolean()
    # saleperson = fields.Char(string="sale person", compute='_compute_sale_team_person')
    # saleteam = fields.Char(string="sale team", compute='_compute_sale_team_person')
    # opportunity = fields.Boolean()

    # @api.onchange('user_id', 'team_id')
    # def onchange_user_id(self):
    #     for rec in self:
    #         self.user_id = rec.user_id
    #         self.team_id = rec.team_id
    #         self.env['sale.order'].update({'user_id': self.user_id, 'team_id': self.team_id})
    #         return {'user_id': self.user_id, 'team_id': self.team_id}

    @api.onchange('user_id', 'team_id', 'type', 'tag_ids', 'priority')
    def onchange_crm_opportunity(self):
        for rec in self:
            self.user_id = rec.user_id
            self.team_id = rec.team_id
            self.type = rec.type
            self.tag_ids = rec.tag_ids
            self.priority = rec.priority

    @api.onchange('onchange_sale_order_template_id')
    def onchange_sale_order_template_id(self):
        super(sale_crm_survey, self).onchange_sale_order_template_id()
        for rec in self:
            self.user_id = rec.user_id
            self.team_id = rec.team_id
    # @api.multi
    # def _compute_sale_team_person(self):
    #     for rec in self:
    #         rec.saleperson = rec.sale_id.user_id.name
    #         rec.saleteam = rec.sale_id.team_id.name

    # @api.multi
    # def action_confirm(self):
    #     print ("I am Here")
    #     super(sale_crm_survey, self).action_confirm()
    #     return {
    #             'type': 'ir.actions.act_url',
    #             'name': "Redirect to the Website shop payment Page",
    #             'target': 'self',
    #             'url': "/shop/payment"
    #         }


class rules(models.Model):
    _name = "sale_crm_survey.rules"

    template_id = fields.Many2one("sale.order.template", string="Template")


class user_input(models.Model):
    _inherit = 'survey.user_input'

    # TODO: quotation_template_id
    quotation_template_id = fields.Many2one('sale.order.template', string="Quotation")
