# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class MassMailingContactListRel(models.Model):
    _inherit = 'mailing.contact.subscription'

    contact_mobile = fields.Char(related='contact_id.mobile', readonly=False)

    @api.model
    def _get_searchable_fields(self):
        return super(MassMailingContactListRel, self)._get_searchable_fields() + ['contact_mobile']
