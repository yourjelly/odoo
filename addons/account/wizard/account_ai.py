# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError


class AccrualAccountingWizard(models.TransientModel):
    _name = 'account.ai.wizard'
    _description = 'Deduce things'

    def raisethings(self):
        raise UserError('things')
