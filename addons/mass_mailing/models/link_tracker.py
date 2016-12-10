# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

class LinkTracker(models.Model):
    _inherit = "link.tracker"

    mass_mailing_id = fields.Many2one('mail.mass_mailing', string='Mass Mailing')
    mass_mailing_campaign_id = fields.Many2one('mail.mass_mailing.campaign', string='Mass Mailing Campaign')


class LinkTrackerClick(models.Model):
    _inherit = "link.tracker.click"

    mail_stat_id = fields.Many2one('mail.mail.statistics', string='Mail Statistics')
    mass_mailing_id = fields.Many2one('mail.mass_mailing', string='Mass Mailing')
    mass_mailing_campaign_id = fields.Many2one('mail.mass_mailing.campaign', string='Mass Mailing Campaign')

    @api.model
    def add_click(self, code, ip, country_code, stat_id=False):
        result = super(LinkTrackerClick, self).add_click(self, code, ip, country_code, stat_id)
        record = self.env['mail.mail.statistics'].browse(stat_id)
        if not record.opened: 
            record.write({'opened': fields.Datetime.now()})
        return result
