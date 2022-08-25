# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

ONBOARDING_STEP_STATES = [
    ('not_done', 'Not done'),
    ('just_done', 'Just done'),
    ('done', 'Done'),
]
ONBOARDING_STATES = ONBOARDING_STEP_STATES + [('closed', "Closed")]


class OnboardingStateMixin(models.AbstractModel):
    """Fields and methods common to onboarding and onboarding step states """
    _name = 'base.onboarding.state.mixin'
    _register = False
    _order = 'sequence'

    company_id = fields.Many2one('res.company')
    state = fields.Selection([], 'Onboarding state', default='not_done')

    @api.model
    def search_or_create(self, tracked_record):
        self.ensure_one()
        model_name_id = self.get_tracked_model_name_id()
        company = self.env.company

        return self.search([
            (model_name_id, '=', tracked_record.id),
            ('company_id', '=?', company.id)
        ]) or self.create({
            model_name_id: tracked_record.id,
            'company_id': company.id if tracked_record.is_per_company else None
        })

    def is_done(self):
        raise NotImplementedError

    @classmethod
    def get_tracked_model_name_id(cls):
        return 'base_onboarding.id'


class OnboardingState(models.Model):
    _name = 'base.onboarding.state'
    _inherit = ['base.onboarding.state.mixin']

    _description = 'Onboarding Completion Tracker'

    onboarding_id = fields.One2many('base.onboarding')
    state = fields.Selection(selection=ONBOARDING_STATES)

    _sql_constraints = [
        ('onboarding_company_uniq', 'unique (step_id,onboarding_id)',
         'There cannot be multiple records of the same onboarding completion for the same company.'),
    ]

    def set_closed(self):
        self.state = 'closed'

    def is_done(self):
        return self.state in {'just_done', 'done', 'closed'}


class OnboardingStepState(models.Model):
    _name = 'base.onboarding.step.state'
    _inherit = ['base.onboarding.state.mixin']

    _description = 'Onboarding Step Completion Tracker'

    step_id = fields.One2many('base.onboarding.step')
    state = fields.Selection(selection=ONBOARDING_STEP_STATES, string='Onboarding Step State')

    _sql_constraints = [
        ('step_company_uniq', 'unique (step_id,company_id)',
         'There cannot be multiple records of the same onboarding step completion for the same company.'),
    ]

    @classmethod
    def get_tracked_model_name_id(cls):
        return 'base_onboarding_step.id'

    def consolidate_just_done(self):
        was_just_done = self.filtered_domain([('state', '=', 'just_done')])
        was_just_done.state = 'done'

    def is_done(self):
        return self.state in {'just_done', 'done'}
