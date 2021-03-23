# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api, fields
from odoo.exceptions import ValidationError
from odoo.tools.translate import _

class Website(models.Model):
    _inherit = 'website'

    def _default_stock_message(self, key):
        template = self.env.ref('website_sale_stock.' + key + '_message', raise_if_not_found=False)
        return template._render() if template else ''

    available_message = fields.Html('In stock', default=lambda self: self._default_stock_message('available'))
    out_of_stock_message = fields.Html('Out of Stock', default=lambda self: self._default_stock_message('out_of_stock'))
    threshold_message = fields.Html('Below Threshold', default=lambda self: self._default_stock_message('threshold'))

    @api.constrains('available_message', 'out_of_stock_message', 'threshold_message')
    def _check_stock_message(self):
        for record in self:
            try:
                record.available_message.format(qty='', unit='')
                record.out_of_stock_message.format(qty='', unit='')
                record.threshold_message.format(qty='', unit='')
            except:
                raise ValidationError(_("You did not use correctly one of the two variables: %s or %s") % ("{qty}", "{unit}"))
