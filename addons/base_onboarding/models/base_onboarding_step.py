# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.addons.base_onboarding.models.base_onboarding_state import ONBOARDING_STEP_STATES


class OnboardingStep(models.Model):
    _name = 'base.onboarding.step'
    _description = 'Onboarding Step'
    _order = 'sequence'

    name = fields.Char('Name of the onboarding step')
    onboarding_id = fields.Many2one('base.onboarding', required=True)
    step_completion_ids = fields.One2many('base.onboarding.step.completion')

    step_template_properties = fields.Text(
        'Step Template Properties', compute='_compute_template_properties', store=False)
    template_title = fields.Char('Title')
    template_description = fields.Char('Description')
    template_button_text = fields.Char('Button text')
    template_done_icon = fields.Char('Font Awesome Icon when completed',
                                     default='fa-star')
    template_done_text = fields.Char('Text to show when step is completed',
                                     default='Step Completed!<br/>Click here to review')
    template_open_action_name = fields.Char('Action to execute when opening the step')
    is_per_company = fields.Boolean('Is this step to be completed per company?',
                                    default=True)
    state = fields.Selection(ONBOARDING_STEP_STATES, compute='_compute_state')

    def set_done(self):
        step_state_model = self.env['base.onboarding.step.state']
        for step in self:
            step_state = step_state_model.search_or_create(step)
            if step_state.state == 'not_done':
                step_state.state = 'just_done'

    _sql_constraints = [
        ('name_uniq', 'UNIQUE (name)', 'Onboarding step name must be unique.'),
        ('name_onboarding_company_uniq',
         'unique (name,onboarding_id)',
         'There cannot be multiple records of the same onboarding step for the same company.')
    ]

    @api.depends('template_title', 'template_description', 'template_button_text',
                 'template_done_icon')
    def _compute_template_properties(self):
        for step in self:
            step.step_template_data = {
                'title': step.template_title,
                'description': step.template_description,
                'btn_text': step.template_button_text,
                'done_icon': step.template_done_icon,
                'done_text': step.template_done_text,
                'method': step.template_open_action_name,
                'model': 'base.onboarding.step',
                'state': step.state,
            }

    @api.depends_context('company')
    def _compute_state(self):
        step_state_model = self.env['base.onboarding.step.state']
        for step in self:
            step.state = step_state_model.search_or_create(step.id).state

    def is_done(self):
        self.ensure_one()
        return self.get_state().is_done

    def get_state(self):
        self.ensure_one()
        return self.env['base.onboarding.step.state'].search_or_create(self.id)
