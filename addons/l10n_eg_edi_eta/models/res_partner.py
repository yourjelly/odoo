# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import models, fields, api


class ResPartner(models.Model):
    _inherit = 'res.partner'

    l10n_eg_national_identifier = fields.Char(string='National ID', copy=False)
    l10n_eg_activity_type_id = fields.Many2one('l10n_eg_edi.activity.type', 'ETA Activity Code', copy=False,
                                               help='This is the activity type of partner according to egyptian tax authority')
    l10n_eg_branch_identifier = fields.Char('ETA Branch ID', copy=False)
    l10n_eg_building_no = fields.Char('Building No.')
    l10n_eg_floor = fields.Char('Floor')
    l10n_eg_room = fields.Char('Room')
    l10n_eg_landmark = fields.Char('Landmark')
    l10n_eg_additional_information = fields.Char('Additional Information')
