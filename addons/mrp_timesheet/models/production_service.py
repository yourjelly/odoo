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
        """ MRP Timesheet module compute delivered qty for product [('type', 'in', ['service']), ('service_type', '=', 'timesheet')] """
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
        domain = lines_by_timesheet._timesheet_compute_delivered_quantity_domain()
        if self._context.get('accrual_entry_date'):
            domain += [('date', '<=', self._context['accrual_entry_date'])]
        mapping = lines_by_timesheet.sudo()._get_delivered_quantity_by_analytic(domain)
        for line in lines_by_timesheet:
            line.qty_delivered = mapping.get(line.id or line._origin.id, 0.0)

    def _timesheet_compute_delivered_quantity_domain(self):
        """ Hook for validated timesheet in addionnal module """
        domain = [('project_id', '!=', False)]
        if self._context.get('accrual_entry_date'):
            domain += [('date', '<=', self._context['accrual_entry_date'])]
        return domain

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

    ###########################################
    # Service : Project and task generation
    ###########################################

    def _convert_qty_company_hours(self, dest_company):
        company_time_uom_id = dest_company.project_time_mode_id
        allocated_hours = 0.0
        product_uom = self.product_uom_id
        if product_uom == self.env.ref('uom.product_uom_unit'):
            product_uom = self.env.ref('uom.product_uom_hour')
        if product_uom.category_id == company_time_uom_id.category_id:
            if product_uom != company_time_uom_id:
                allocated_hours = product_uom._compute_quantity(self.product_qty, company_time_uom_id)
            else:
                allocated_hours = self.product_qty
        return allocated_hours
    
    def _timesheet_create_project(self):
        project = super()._timesheet_create_project()
        # we can skip all the allocated hours calculation if allocated hours is already set on the template project
        if self.product_id.project_template_id.allocated_hours:
            project.write({
                'allocated_hours': self.product_id.project_template_id.allocated_hours,
                'allow_timesheets': True,
            })
            return project
        project_uom = self.company_id.project_time_mode_id
        uom_unit = self.env.ref('uom.product_uom_unit')
        uom_hour = self.env.ref('uom.product_uom_hour')

        # dict of inverse factors for each relevant UoM found in MO
        factor_inv_per_id = {
            uom.id: uom.factor_inv
            for uom in self.production_id.service_ids.product_uom_id
            if uom.category_id == project_uom.category_id
        }
        # if sold as units, assume hours for time allocation
        factor_inv_per_id[uom_unit.id] = uom_hour.factor_inv

        allocated_hours = 0.0
        # method only called once per project, so also allocate hours for
        # all service lines in MO that will share the same project
        for line in self.production_id.service_ids:
            if line.product_id.service_tracking in ['task_in_project', 'project_only'] \
                    and line.product_id.project_template_id == self.product_id.project_template_id \
                    and line.product_uom_id.id in factor_inv_per_id:
                uom_factor = project_uom.factor * factor_inv_per_id[line.product_uom_id.id]
                allocated_hours += line.product_qty * uom_factor

        project.write({
            'allocated_hours': allocated_hours,
            'allow_timesheets': True,
        })
        return project
