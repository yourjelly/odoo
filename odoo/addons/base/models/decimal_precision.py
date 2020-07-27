# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, tools, _
import odoo.addons

import logging
import sys
_logger = logging.getLogger(__name__)


def get_precision(application):
    _logger.warning("Deprecated call to decimal_precision.get_precision(<application>), use digits=<application> instead")
    return application


class DecimalPrecision(models.Model):
    _name = 'decimal.precision'
    _description = 'Decimal Precision'

    name = fields.Char('Usage', index=True, required=True)
    digits = fields.Integer('Digits', required=True, default=2)

    _sql_constraints = [
        ('name_uniq', 'unique (name)', """Only one value can be defined for each given usage!"""),
    ]

    @api.onchange('digits')
    def _onchange_digits(self):
        all_uom = self.env['uom.uom'].search([])
        accuracy_xml_id = self.env['ir.model.data'].search([('name','=','decimal_product_uom')])
        if self._origin.id == accuracy_xml_id.res_id:
            for uom in all_uom:
                if 1.0 / 10.0**self.digits > uom.rounding:
                    warning = {
                            'title': _('Warning!'),
                            'message':
                                _(
                                "You are setting a Decimal Accuracy less precise than"
                                " the UOM '%s' (id=%s, precision=%s).\n"
                                "This may cause issues in quant reservations.\n"
                                "Please set a higher number of Digits."
                                %(uom.name, str(uom.id), str(uom.rounding))
                                )
                            ,
                        }
                    return {'warning': warning}

    @api.model
    @tools.ormcache('application')
    def precision_get(self, application):
        self.env.cr.execute('select digits from decimal_precision where name=%s', (application,))
        res = self.env.cr.fetchone()
        return res[0] if res else 2

    @api.model_create_multi
    def create(self, vals_list):
        res = super(DecimalPrecision, self).create(vals_list)
        self.clear_caches()
        return res

    def write(self, data):
        res = super(DecimalPrecision, self).write(data)
        self.clear_caches()
        return res

    def unlink(self):
        res = super(DecimalPrecision, self).unlink()
        self.clear_caches()
        return res


class DecimalPrecisionFloat(models.AbstractModel):
    """ Override qweb.field.float to add a `decimal_precision` domain option
    and use that instead of the column's own value if it is specified
    """
    _inherit = 'ir.qweb.field.float'


    @api.model
    def precision(self, field, options=None):
        dp = options and options.get('decimal_precision')
        if dp:
            return self.env['decimal.precision'].precision_get(dp)

        return super().precision(field, options=options)

# compatibility for decimal_precision.get_precision(): expose the module in addons namespace
dp = sys.modules['odoo.addons.base.models.decimal_precision']
odoo.addons.decimal_precision = dp
sys.modules['odoo.addons.decimal_precision'] = dp
sys.modules['openerp.addons.decimal_precision'] = dp
