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
    _description = 'Onboarding State Mixin'

    company_id = fields.Many2one('res.company')
    state = fields.Selection(selection=[], string='Onboarding state', default='not_done')

    @api.model
    def search_or_create(self, tracked_record):
        tracked_field = self.get_tracked_field()
        company = self.env.company

        return self.search([
            (tracked_field, '=', tracked_record.id),
            ('company_id', '=?', company.id)
        ]) or self.create({
            tracked_field: tracked_record.id,
            'company_id': company.id if tracked_record.is_per_company else None
        })

    def is_done(self):
        raise NotImplementedError

    @classmethod
    def get_tracked_field(cls):
        return 'onboarding_id'


class OnboardingState(models.Model):
    _name = 'base.onboarding.state'
    _inherit = ['base.onboarding.state.mixin']

    _description = 'Onboarding Completion Tracker'

    onboarding_id = fields.Many2one('base.onboarding', 'Onboarding Tracked')
    state = fields.Selection(selection_add=ONBOARDING_STATES)

    _sql_constraints = [
        ('onboarding_company_uniq', 'unique (onboarding_id,company_id)',
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

    step_id = fields.Many2one('base.onboarding.step', 'Onboarding Step Tracked')
    state = fields.Selection(selection_add=ONBOARDING_STEP_STATES, string='Onboarding Step State')

    _sql_constraints = [
        ('step_company_uniq', 'unique (step_id,company_id)',
         'There cannot be multiple records of the same onboarding step completion for the same company.'),
    ]

    @classmethod
    def get_tracked_field(cls):
        return 'step_id'

    def consolidate_just_done(self):
        was_just_done = self.filtered_domain([('state', '=', 'just_done')])
        was_just_done.state = 'done'

    def is_done(self):
        return self.state in {'just_done', 'done'}
