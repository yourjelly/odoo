# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict

from odoo import models
from odoo.tools import populate

TEAM_SIZES = {'small': 1, 'medium': 10, 'large': 20}

class Tag(models.Model):
    _inherit = 'crm.tag'
    _populate_sizes = {'small': 4, 'medium': 8, 'large': 12}

    def _populate_factories(self):
        return [
            ("name", populate.constant('tag_{counter}')),
            ("color", populate.randint(1, 11)),
        ]

class Team(models.Model):
    _inherit = 'crm.team'
    _populate_sizes = {'small': 5, 'medium': 15, 'large': 40}
    _populate_dependencies = {"res.users"}

    def _populate_factories(self):
        user_ids = self.env.registry.populated_models["res.users"]

        def get_company_id(values, **kwargs):
            return self.env['res.users'].browse(values["user_id"]).company_id.id

        return [
            ("name", populate.constant('Sales Team_{counter}')),
            ("user_id", populate.randomize(user_ids)),
            ("company_id", populate.compute(get_company_id)),
            ("color", populate.randint(1, 11)),
            ("is_favorite", populate.randomize([True, False], [0.2, 0.8])),
        ]

    def _populate(self, size):
        self.env['ir.config_parameter'].sudo().set_param('is_membership_multi', True)
        teams = super()._populate(size)

        random = populate.Random('assign_team_members')

        for team in teams:
            user_ids = self.env['res.users'].search([('company_id', '=', team.company_id.id)]).ids
            team.member_ids = [(6, 0, [team.user_id.id] + random.sample(user_ids, TEAM_SIZES[size]-1))]

        return teams

class Lead(models.Model):
    _inherit = 'crm.lead'
    _populate_sizes = {'small': 500, 'medium': 5000, 'large': 50000}
    _populate_dependencies = {"crm.team", "crm.tag"}

    def _populate_factories(self):
        stages = self.env["crm.stage"].search([])
        won_stages = stages.filtered(lambda s: s.is_won)
        user_ids = self.env.registry.populated_models["res.users"]
        tag_ids = self.env.registry.populated_models["crm.tag"]
        partners = self.env['res.partner'].search([])

        def get_tags(random, **kwargs):
            return [(6, 0, random.sample(tag_ids, random.randint(1, 3)))]

        def get_stage_id(random, **kwargs):
            if random.random() >= 0.85:
                return random.choice(won_stages.ids)
            return random.choice((stages-won_stages).ids)

        def get_partner_id(values, counter, random):
            partner_ids = partners.search([(
                'company_id', '=', self.env['res.users'].browse(values['user_id']).company_id.id)
            ]).ids
            return random.choice(partner_ids)

        return [
            ("name", populate.constant('Lead #{counter}')),
            ("user_id", populate.randomize(user_ids)),
            ("partner_id", populate.compute(get_partner_id)),
            ("tag_ids", populate.compute(get_tags)),
            ("priority", populate.randomize(['0', '1', '2', '3'])),
            ("stage_id", populate.compute(get_stage_id)),
            ("expected_revenue", populate.randint(0, 40000)),
        ]

    def _populate(self, size):
        leads = super()._populate(size)
        lost_reasons = self.env['crm.lost.reason'].search([]).ids

        def schedule_activities(activity_types, random):
            activity_leads = defaultdict(list)
            for lead in leads:
                activity_leads[random.choice(activity_types)].append(lead.id)
            for xml_id, lead_ids in activity_leads.items():
                records = self.browse(lead_ids)
                records.activity_schedule(xml_id)
                records.activity_feedback([xml_id])

        def set_to_lost(lead, random):
            lead.action_set_lost(lost_reason=random.choice(lost_reasons))

        activity_types = self.env["ir.model.data"].search([("model", "=", "mail.activity.type")]).mapped("complete_name")
        random = populate.Random("random activity type")
        schedule_activities(activity_types, random)
        for lead in leads:
            if random.random() > 0.9:
                set_to_lost(lead, random)

        return leads
