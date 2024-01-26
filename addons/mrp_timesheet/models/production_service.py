# Part of Odoo. See LICENSE file for full copyright and licensing details.
from collections import defaultdict

from odoo import models, fields, api
from odoo.osv import expression


class ProductionService(models.Model):
    _inherit = "mrp.production.service"

    qty_delivered_method = fields.Selection(selection_add=[('timesheet', 'Timesheets')])
    timesheet_ids = fields.One2many('account.analytic.line', 'mo_service', domain=[('project_id', '!=', False)], string='Timesheets')

    @api.depends('product_id')
    def _compute_qty_delivered_method(self):
        """ MRP Timesheet module comput delivered qty for product [('type', 'in', ['service']), ('service_type', '=', 'timesheet')] """
        super()._compute_qty_delivered_method()
        for service in self:
            if service.product_id.service_type == 'timesheet':
                service.qty_delivered_method = 'timesheet'

    @api.depends(
        'qty_delivered_method',
        'timesheet_ids.mo_service',
        'timesheet_ids.unit_amount',
        'timesheet_ids.product_uom_id')
    def _compute_qty_delivered(self):
        super()._compute_qty_delivered()
        lines_by_timesheet = self.filtered(lambda mos: mos.qty_delivered_method == 'timesheet')
        domain = [('project_id', '!=', False)]
        if self._context.get('accrual_entry_date'):
            domain += [('date', '<=', self._context['accrual_entry_date'])]
        mapping = lines_by_timesheet.sudo()._get_delivered_quantity_by_analytic(domain)
        for line in lines_by_timesheet:
            line.qty_delivered = mapping.get(line.id or line._origin.id, 0.0)

    def _get_delivered_quantity_by_analytic(self, additional_domain):
        """ Compute and write the delivered quantity of current MO service lines, based on their related
            analytic lines.
            :param additional_domain: domain to restrict AAL to include in computation (required since timesheet is an AAL with a project ...)
        """
        result = defaultdict(float)

        # avoid re-computation if no MO lines concerned
        if not self:
            return result

        # group analytic lines by product uom and so line
        domain = expression.AND([[('mo_service', 'in', self.ids)], additional_domain])
        data = self.env['account.analytic.line']._read_group(
            domain,
            ['product_uom_id', 'mo_service'],
            ['unit_amount:sum', 'move_line_id:count_distinct', '__count'],
        )

        # convert uom and sum all unit_amount of analytic lines to get the delivered qty of MO service lines
        for uom, mo_service, unit_amount_sum, move_line_id_count_distinct, count in data:
            if not uom:
                continue
            # avoid counting unit_amount twice when dealing with multiple analytic lines on the same move line
            if move_line_id_count_distinct == 1 and count > 1:
                qty = unit_amount_sum / count
            else:
                qty = unit_amount_sum
            if mo_service.product_uom_id.category_id == uom.category_id:
                qty = uom._compute_quantity(qty, mo_service.product_uom_id, rounding_method='HALF-UP')
            result[mo_service.id] += qty

        return result
