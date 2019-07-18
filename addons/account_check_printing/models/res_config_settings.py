# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    country_code = fields.Char(string="Company Country code", related='company_id.country_id.code', readonly=True)
    account_check_printing_report_action_id = fields.Many2one('ir.actions.report', related='company_id.account_check_printing_report_action_id', string="Check Layout", readonly=False,
        help="Select the format corresponding to the check paper you will be printing your checks on. In order to disable the printing feature, leave it empty.")
    mismatched_check_layout = fields.Boolean(compute='_compute_mismatched_check_layout',
        help="Set to True if selecte Check Layout is not of current user's country.")
    account_check_printing_date_label = fields.Boolean(related='company_id.account_check_printing_date_label', string="Print Date Label", readonly=False,
        help="This option allows you to print the date label on the check as per CPA. Disable this if your pre-printed check includes the date label.")
    account_check_printing_multi_stub = fields.Boolean(related='company_id.account_check_printing_multi_stub', string='Multi-Pages Check Stub', readonly=False,
        help="This option allows you to print check details (stub) on multiple pages if they don't fit on a single page.")
    account_check_printing_margin_top = fields.Float(related='company_id.account_check_printing_margin_top', string='Check Top Margin', readonly=False,
        help="Adjust the margins of generated checks to make it fit your printer's settings.")
    account_check_printing_margin_left = fields.Float(related='company_id.account_check_printing_margin_left', string='Check Left Margin', readonly=False,
        help="Adjust the margins of generated checks to make it fit your printer's settings.")
    account_check_printing_margin_right = fields.Float(related='company_id.account_check_printing_margin_right', string='Check Right Margin', readonly=False,
        help="Adjust the margins of generated checks to make it fit your printer's settings.")

    @api.depends('account_check_printing_report_action_id')
    def _compute_mismatched_check_layout(self):
        report_action = self.account_check_printing_report_action_id
        if report_action:
            xml_id = report_action.get_external_id().get(report_action.id)
            # check layout report actions would be created through l10n_xx_check_printing modules, so here,
            # we are identifying particular country's check layout using country code from module's xml id.
            country_code = xml_id[5:7].upper()
            self.mismatched_check_layout = country_code != self.country_code
