# -*- coding: utf-8 -*-
from odoo import fields, models, release
from odoo.tools.parse_version import parse_version

import logging

_logger = logging.getLogger(__name__)

class Check(models.Model):
    _name = 'upgradewizard.check'
    _description = 'Checks'
    _order = "state,order asc"

    name = fields.Char(required=True)
    code = fields.Text(default="")
    #passed = fields.Boolean(default=False)
    state = fields.Selection([
        ('success', 'Success'),
        ('input_needed', 'Input Needed'),
        ('fail', 'Failed'),
        ('irrelevant', 'Irrelevant'),
        ('warning', 'Warning')
    ])
    comments = fields.Text()
    min_version = fields.Char()
    max_version = fields.Char()
    modules = fields.Char()
    order = fields.Integer()
    choice = fields.Many2one('upgradewizard.choiceoption', domain="[('check_id', '=', id)]")
    choices_info = fields.Text(compute='_get_choices_info')
    user_message = fields.Char()


    def _get_choices_info(self):
        info = ""
        for choice in self.env['upgradewizard.choiceoption'].search([('check_id', '=', self.id)]):
            info += "%s: %s\n" % (choice.name, choice.description)
        self.choices_info = info

    def _check_versions(self):
        current_version = release.version
        if (self.min_version and parse_version(current_version) < parse_version(self.min_version)) or\
            (self.max_version and parse_version(current_version) > parse_version(self.max_version)):
            self.state = 'irrelevant'
            self.comments = "Minimum version: %s, current version: %s, maximum version: %s" %\
                (self.min_version if self.min_version else "N/A", current_version, self.max_version if self.max_version else "N/A")
            return True

    def _check_modules(self):
        if not self.modules:
            return
        installed_modules = self.env['ir.module.module'].search([('state', '=', 'installed')]).mapped('name')
        for module in self.modules.split(','):
            if module not in installed_modules:
                self.comments = "Module %s not installed" % module
                self.state = 'irrelevant'
                return True

    def _check_options(self):
        if (self.env['upgradewizard.choiceoption'].search([('check_id', '=', self.id)])):
            if not self.choice:
                self.state = 'input_needed'
                self.comments = self.user_message if self.user_message else "Input needed"
            else:
                self.comments = "Option selected: %s" % self.choice.name
                self.state = 'success'
                return True

    def run_check(self):
        self.state = 'fail'
        self.comments = None
        _logger.info("Running check: %s" % self.name)
        if self._check_versions():
            return
        if self._check_modules():
            return
        if self._check_options():
            return
        exec(self.code)

    def write(self, vals):
        res = super(Check, self).write(vals)
        if 'choice' in vals:
            self.run_check()
        return res


class ChoiceOption(models.Model):
    _name = 'upgradewizard.choiceoption'
    _description = 'Choice options'

    name = fields.Char(required=True)
    description = fields.Text()
    check_id = fields.Many2one('upgradewizard.check', required=True)
