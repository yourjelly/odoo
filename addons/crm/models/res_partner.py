# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class Partner(models.Model):
    _name = 'res.partner'
    _inherit = 'res.partner'

    team_id = fields.Many2one('crm.team', string='Sales Team')
    opportunity_ids = fields.One2many('crm.lead', 'partner_id', string='Opportunities', domain=[('type', '=', 'opportunity')])
    meeting_ids = fields.Many2many('calendar.event', 'calendar_event_res_partner_rel', 'res_partner_id', 'calendar_event_id', string='Meetings', copy=False)
    opportunity_count = fields.Integer("Opportunity", compute='_compute_opportunity_count')
    meeting_count = fields.Integer("# Meetings", compute='_compute_meeting_count')

    @api.model
    def default_get(self, fields):
        rec = super(Partner, self).default_get(fields)
        active_model = self.env.context.get('active_model')
        if active_model == 'crm.lead':
            lead = self.env[active_model].browse(self.env.context.get('active_id')).exists()
            if lead:
                rec.update(
                    phone=lead.phone,
                    mobile=lead.mobile,
                    function=lead.function,
                    title=lead.title.id,
                    website=lead.website,
                    street=lead.street,
                    street2=lead.street2,
                    city=lead.city,
                    state_id=lead.state_id.id,
                    country_id=lead.country_id.id,
                    zip=lead.zip,
                )
        return rec

    def _compute_opportunity_count(self):
        partners_group = self.env['crm.lead'].read_group([('partner_id.commercial_partner_id', 'in', self.ids)], ['partner_id'], ['partner_id'])
        partners = {d['partner_id'][0]: d['partner_id_count'] for d in partners_group}
        commercial_partners = {}
        for partner in self.browse(partners.keys()):
            commercial_partners.setdefault(partner.commercial_partner_id.id, 0)
            commercial_partners[partner.commercial_partner_id.id] += partners[partner.id]
        for partner in self:
            if partner.is_company:
                partner.opportunity_count = commercial_partners.get(partner.id, 0)
            else:
                partner.opportunity_count = partners.get(partner.id, 0)

    def _compute_meeting_count(self):
        self.env.cr.execute('select res_partner_id, count(1) from calendar_event_res_partner_rel where res_partner_id in ('+ ','.join(map(str, self.ids))+') group by res_partner_id')
        results = {row[0]: row[1] for row in self.env.cr.fetchall()}
        for partner in self:
            partner.meeting_count = results.get(partner.id, 0)

    def schedule_meeting(self):
        partner_ids = self.ids
        partner_ids.append(self.env.user.partner_id.id)
        action = self.env.ref('calendar.action_calendar_event').read()[0]
        action['context'] = {
            'default_partner_ids': partner_ids,
        }
        return action
