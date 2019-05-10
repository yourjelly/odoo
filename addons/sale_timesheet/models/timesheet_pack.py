# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class TimesheetPack(models.Model):
    _inherit = 'timesheet.pack'

    def _default_domain_sale_line_id(self):
        return [('is_service', '=', True), ('is_expense', '=', False), ('state', 'in', ['sale', 'done'])]

    sale_line_id = fields.Many2one('sale.order.line', 'Sales Order Item', domain=lambda self: self._default_domain_sale_line_id())

    @api.multi
    @api.constrains('sale_line_id')
    def _check_sale_line_type(self):
        for record in self:
            if record.sale_line_id:
                if not record.sale_line_id.is_service or record.sale_line_id.is_expense:
                    raise ValidationError(_('You cannot link the order item %s - %s to this document because it is a re-invoiced expense.' % (record.sale_line_id.order_id.id, record.sale_line_id.product_id.name)))


class TimesheetMixin(models.AbstractModel):
    _inherit = 'timesheet.pack.mixin'

    sale_line_id = fields.Many2one('sale.order.line', related='timesheet_pack_id.sale_line_id', readonly=False)

    @api.multi
    def unlink(self):
        if any(record.sale_line_id for record in self):
            raise ValidationError(_('You have to unlink the task from the sale order item in order to delete it.'))
        return super(TimesheetMixin, self).unlink()
