# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    cal_client_id = fields.Char("Client_id", config_parameter='google_calendar_client_id', default='')
    cal_client_secret = fields.Char("Client_key", config_parameter='google_calendar_client_secret', default='')
    cal_sync_paused = fields.Boolean("Google Synchronization Paused", config_parameter='google_calendar_sync_paused',
        help="Indicates if synchronization with Google Calendar is paused or not.")

def write(self, vals):
    configs = super().write(vals)
    if 'cal_sync_paused' in vals and not vals['cal_sync_paused']:
        # Check if the user has a Google Calendar account and if it is authenticated
        if self.env.user.google_calendar_account_id and self.env.user.google_calendar_account_id._google_calendar_authenticated():
            self.env['calendar.recurrence']._restart_google_sync()
            self.env['calendar.event']._restart_google_sync()
    return configs
