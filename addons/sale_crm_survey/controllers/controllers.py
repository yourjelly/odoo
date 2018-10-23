# -*- coding: utf-8 -*-
from odoo.addons.survey.controllers.main import Survey
from odoo import http
import logging
from odoo.http import request

_logger = logging.getLogger(__name__)


class SaleCrmSurvey(Survey):
    @http.route()
    def start_survey(self, survey, token=None, **post):
        res = super(SaleCrmSurvey, self).start_survey(survey)
        template_id = post.get('template_id')
        order_id = request.env['sale.order.template'].sudo().search([('id', '=', template_id)])
        user_input = res.qcontext.get('user_input')
        if user_input and order_id:
            user_input.write({'quotation_template_id': template_id})
        return res

    @http.route(['/survey/finish/<model("survey.survey"):survey>/<string:token>'], type='http', auth='public', website=True)
    def survey_finish(self, survey, token, **post):
        UserInput = request.env['survey.user_input']
        user_input = UserInput.sudo().search([('token', '=', token)], limit=1)

        email = post.get('email')
        name = post.get('name')
        if not user_input:  # Invalid token
            return request.render("survey.403", {'survey': survey})

        partner_id = request.env['res.partner'].sudo().search([('email', '=', email)], limit=1)
        if not partner_id:
            partner_id = request.env['res.partner'].sudo().create({'name': name, 'email': email})
        return self.survey_saleOrder_opportunity(survey, token, partner_id)

    # Survey displaying
    @http.route()
    def fill_survey(self, survey, token, prev=None, **post):
        UserInput = request.env['survey.user_input']
        user_input = UserInput.sudo().search([('token', '=', token)], limit=1)
        partner_id = request.env.user.partner_id
        if user_input.state == 'done' and user_input.quotation_template_id:
            if not request.env.user.has_group('base.group_public'):
                return self.survey_saleOrder_opportunity(survey, token, partner_id)
            else:
                data = {'survey': survey, 'token': user_input.token, 'template_id': user_input.quotation_template_id.id}
                return request.render('sale_crm_survey.sfinished', data)
        res = super(SaleCrmSurvey, self).fill_survey(survey, token)
        res.qcontext.update({'template_id': user_input.quotation_template_id.id})
        return res

    def survey_saleOrder_opportunity(self, survey, token, partner_id):
        quote_template = request.env['sale.order.template'].sudo().search([], limit=1)
        if quote_template.confirmation == "opportunity":
            crm_id = request.env['crm.lead'].sudo().create({'name': quote_template.name, 'partner_id': partner_id.id, 'user_id': quote_template.user_id.id, 'team_id': quote_template.team_id.id, 'type': quote_template.type, 'tag_ids': quote_template.tag_ids.ids, 'priority': quote_template.priority})
            quote_template.onchange_crm_opportunity()
            opp_id = request.env['crm.lead2opportunity.partner'].with_context({'active_ids': crm_id.ids}).create({'name': 'convert', 'user_id': quote_template.user_id.id, 'team_id': quote_template.team_id.id, 'partner_id': partner_id.id})
            res = opp_id.action_apply()
            sale_id = request.env['sale.order'].with_context({'search_default_partner_id': crm_id.partner_id.id, 'default_partner_id': crm_id.partner_id.id, 'default_team_id': crm_id.team_id.id, 'default_campaign_id': crm_id.campaign_id.id, 'default_medium_id': crm_id.medium_id.id, 'default_origin': crm_id.name, 'default_source_id': crm_id.source_id.id}).create({'partner_id': partner_id.id, 'sale_order_template_id': quote_template.id, 'user_id': crm_id.user_id.id, 'team_id': crm_id.team_id.id})
        else:
            sale_id = request.env['sale.order'].sudo().create({'partner_id': partner_id.id, 'sale_order_template_id': quote_template.id, 'user_id': quote_template.user_id.id, 'team_id': quote_template.team_id.id})
            sale_id.onchange_sale_order_template_id()
        sale_id.action_confirm()
        sale_id.message_subscribe(partner_ids=partner_id.ids)
        if request.env.user.has_group('base.group_public'):
            return request.redirect(sale_id._get_share_url())
        return request.redirect('/my/orders/%s' % (sale_id.id))
