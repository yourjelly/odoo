# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError
from odoo.osv import expression


class Project(models.Model):
    _inherit = 'project.project'

    sale_line_id = fields.Many2one('sale.order.line', 'Sales Order Item', domain="[('is_expense', '=', False), ('order_id', '=', sale_order_id), ('state', 'in', ['sale', 'done'])]", copy=False,
        help="Sales order item to which the project is linked. If an employee timesheets on a task that does not have a "
        "sale order item defines, and if this employee is not in the 'Employee/Sales Order Item Mapping' of the project, "
        "the timesheet entry will be linked to the sales order item defined on the project.")
    sale_order_id = fields.Many2one('sale.order', 'Sales Order', domain="[('partner_id', '=', partner_id), ('state', 'in', ['sale', 'done'])]", copy=False, help="Sales order to which the project is linked.")
    billable_type = fields.Selection([
        ('no', 'No Billable'),
        ('task_rate', 'At Task Rate'),
        ('project_rate', 'At Project Rate'),
        ('employee_rate', 'At Employee Rate'),
    ], string="Billable Type", default='no', required=True, copy=False,
        help='At which rate timesheets will be billed:\n'
        ' - At task rate: each time spend on a task is billed at task rate.\n'
        ' - At project rate: each time spend on a task is billed at project rate (defined by the sales order item of the project).\n'
        ' - At employee rate: each employee log time billed at his rate.\n'
        ' - No Billable: track time without invoicing it')
    sale_line_employee_ids = fields.One2many('project.sale.line.employee.map', 'project_id', "Employee Rates", copy=False,
        help="Employee/Sale Order Item Mapping:\n Defines to which sales order item an employee's timesheet entry will be linked."
        "By extension, it defines the rate at which an employee's time on the project is billed.")

    _sql_constraints = [
        ('sale_order_required_if_sale_line', "CHECK((sale_line_id IS NOT NULL AND sale_order_id IS NOT NULL) OR (sale_line_id IS NULL))", 'The Project should be linked to a Sale Order to select an Sale Order Items.'),
        ('sale_line_required_if_project_rate', "CHECK((billable_type = 'project_rate' AND sale_line_id IS NOT NULL) OR (billable_type != 'project_rate'))", 'The Project should be linked to a Sales Order Item to defined its rate.'),
        ('sale_order_required_if_employee_rate', "CHECK((billable_type = 'employee_rate' AND sale_order_id IS NOT NULL) OR (billable_type != 'employee_rate'))", 'The Project should be linked to a Sales Order to be able to fill employees rates.'),
    ]

    @api.onchange('billable_type')
    def _onchange_billable_type(self):
        if self.billable_type in ['no', 'task_rate']:
            self.sale_line_id = False
            self.sale_order_id = False
            self.sale_line_employee_ids = False
        elif self.billable_type == 'project_rate':
            self.sale_line_employee_ids = False

    @api.onchange('partner_id')
    def _onchange_partner_id(self):
        if not self.partner_id:
            self.sale_line_id = False
            self.sale_order_id = False

    @api.onchange('partner_id')
    def _onchange_partner_id_domain_sale_order(self):
        domain = [('state', 'in', ['sale', 'done'])]
        if self.partner_id:
            domain = expression.AND([domain, [('partner_id', 'child_of', self.partner_id.commercial_partner_id.id)]])
        return {
            'domain': {
                'sale_order_id': domain
            }
        }

    @api.constrains('sale_line_id', 'billable_type')
    def _check_sale_line_type(self):
        for project in self:
            if project.billable_type == 'task_rate':
                if project.sale_line_id and not project.sale_line_id.is_service:
                    raise ValidationError(_("A billable project should be linked to a Sales Order Item having a Service product."))
                if project.sale_line_id and project.sale_line_id.is_expense:
                    raise ValidationError(_("A billable project should be linked to a Sales Order Item that does not come from an expense or a vendor bill."))

    @api.constrains('sale_line_id', 'sale_order_id')
    def _check_sale_line_in_sale_order(self):
        for project in self:
            if project.sale_order_id and project.sale_line_id:
                if project.sale_line_id not in project.sale_order_id.order_line:
                    raise ValidationError(_("The Sales Order Items attached the the project should be linked to Sales Order's Project"))

    @api.constrains('billable_type', 'sale_line_employee_ids')
    def _check_billable_type_employee_rate(self):
        for project in self:
            if project.billable_type == 'employee_rate' and not project.sale_line_employee_ids:
                raise ValidationError(_('A project billed at employee rate must have at least one employee rate defined.'))

    # ---------------------------------------------------
    # Actions
    # ---------------------------------------------------

    @api.multi
    def action_view_timesheet(self):
        self.ensure_one()
        if self.allow_timesheets:
            return self.action_view_timesheet_plan()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Timesheets of %s') % self.name,
            'domain': [('project_id', '!=', False)],
            'res_model': 'account.analytic.line',
            'view_id': False,
            'view_mode': 'tree,form',
            'help': _("""
                <p class="o_view_nocontent_smiling_face">
                    Record timesheets
                </p><p>
                    You can register and track your workings hours by project every
                    day. Every time spent on a project will become a cost and can be re-invoiced to
                    customers if required.
                </p>
            """),
            'limit': 80,
            'context': {
                'default_project_id': self.id,
                'search_default_project_id': [self.id]
            }
        }

    @api.multi
    def action_view_timesheet_plan(self):
        action = self.env.ref('sale_timesheet.project_timesheet_action_client_timesheet_plan').read()[0]
        action['params'] = {
            'project_ids': self.ids,
        }
        action['context'] = {
            'active_id': self.id,
            'active_ids': self.ids,
            'search_default_display_name': self.name,
        }
        return action

    @api.multi
    def action_make_billable(self):
        return {
            "name": _("Create Sales Order"),
            "type": 'ir.actions.act_window',
            "res_model": 'project.create.sale.order',
            "views": [[False, "form"]],
            "target": 'new',
            "context": {
                'active_id': self.id,
                'active_model': 'project.project',
            },
        }

    # ---------------------------------------------------
    # Business Methods
    # ---------------------------------------------------

    @api.model
    def _map_tasks_default_valeus(self, task):
        defaults = super(Project, self)._map_tasks_default_valeus(task)
        defaults['sale_line_id'] = False
        return defaults

    def _create_sale_order_prepare_values(self):
        return {
            'project_id': self.id,
            'partner_id': self.partner_id.id,
            'analytic_account_id': self.analytic_account_id.id,
            'client_order_ref': self.name,
            'company_id': self.company_id.id,
        }

    def _create_sale_order(self):
        values = self._create_sale_order_prepare_values()
        sale_order = self.env['sale.order'].create(values)
        sale_order.onchange_partner_id()
        sale_order.onchange_partner_shipping_id()
        return sale_order


class ProjectTask(models.Model):
    _inherit = "project.task"

    @api.model
    def _get_default_partner(self):
        partner = False
        if 'default_project_id' in self.env.context:  # partner from SO line is prior on one from project
            project_sudo = self.env['project.project'].browse(self.env.context['default_project_id']).sudo()
            partner = project_sudo.sale_line_id.order_partner_id
        if not partner:
            partner = super(ProjectTask, self)._get_default_partner()
        return partner

    @api.model
    def _default_sale_line_id(self):
        sale_line_id = False
        if self._context.get('default_parent_id'):
            parent_task = self.env['project.task'].browse(self._context['default_parent_id'])
            sale_line_id = parent_task.sale_line_id.id
        if not sale_line_id and self._context.get('default_project_id'):
            project = self.env['project.project'].browse(self.env.context['default_project_id'])
            if project.billable_type in ['task_rate', 'project_rate']:  # default value for task_rate (can be null), forced value for project_rate
                sale_line_id = project.sale_line_id.id
        return sale_line_id

    @api.model
    def _default_domain_sale_line_id(self):
        return ['&', '&', ('is_service', '=', True), ('is_expense', '=', False), ('state', 'in', ['sale', 'done'])]

    sale_line_id = fields.Many2one('sale.order.line', 'Sales Order Item', default=_default_sale_line_id, domain=lambda self: self._default_domain_sale_line_id(),
        help="Sales order item to which the task is linked. If an employee timesheets on a this task, "
        "and if this employee is not in the 'Employee/Sales Order Item Mapping' of the project, the "
        "timesheet entry will be linked to this sales order item.")
    sale_order_id = fields.Many2one('sale.order', 'Sales Order', compute='_compute_sale_order_id', compute_sudo=True, store=True, readonly=True, help="Sales order to which the task is linked.")
    billable_type = fields.Selection([
        ('no', 'No Billable'),
        ('task_rate', 'At Task Rate'),
        ('project_rate', 'At Project Rate'),
        ('employee_rate', 'At Employee Rate'),
    ], string="Billable Type", default='no', compute='_compute_billable_type', store=True)
    is_project_map_empty = fields.Boolean("Is Project map empty", compute='_compute_is_project_map_empty')

    @api.multi
    @api.depends('sale_line_id', 'project_id', 'billable_type')
    def _compute_sale_order_id(self):
        for task in self:
            if task.billable_type == 'task_rate':
                task.sale_order_id = task.sale_line_id.order_id or task.project_id.sale_order_id
            elif task.billable_type in ['employee_rate', 'project_rate']:
                task.sale_order_id = task.project_id.sale_order_id
            elif task.billable_type == 'no':
                task.sale_order_id = False

    @api.multi
    @api.depends('project_id.billable_type')
    def _compute_billable_type(self):
        for task in self:
            billable_type = 'no'
            if task.project_id:  # task without project are non billable (we want to force the 'no' value instead of NULL)
                billable_type = task.project_id.billable_type
            task.billable_type = billable_type

    @api.depends('project_id.sale_line_employee_ids')
    def _compute_is_project_map_empty(self):
        for task in self:
            task.is_project_map_empty = not bool(task.project_id.sale_line_employee_ids)

    @api.onchange('project_id')
    def _onchange_project(self):
        result = super(ProjectTask, self)._onchange_project() or {}
        # deduce default sales order line value
        if self.billable_type in ['task_rate', 'project_rate']:
            self.sale_line_id = self.project_id.sale_line_id
        else:
            self.sale_line_id = False
        # deduce partner from the SO / SOL according to billable type
        if not self.partner_id:
            if self.billable_type in ['project_rate', 'employee_rate']:
                self.partner_id = self.project_id.sale_order_id.partner_id
            elif self.billable_type == 'task_rate':
                self.partner_id = self.sale_line_id.order_partner_id
        return result

    @api.onchange('billable_type', 'partner_id')
    def _onchange_sale_line_domain(self):
        domain = self._default_domain_sale_line_id()
        if self.partner_id:
            domain = expression.AND([domain, [('order_partner_id', 'child_of', self.partner_id.commercial_partner_id.id)]])
        if self.project_id.sale_order_id:  # task_rate
            domain = expression.AND([domain, [('order_id', '=', self.project_id.sale_order_id.id)]])
        return {
            'domain': {
                'sale_line_id': domain
            }
        }

    @api.onchange('project_id')
    def _onchange_billable_type_warning(self):
        if self.timesheet_ids:
            if self.project_id.billable_type != 'no':
                return {
                    'warning': {
                        'title': _("Warning"),
                        'message': _("Changing project will change the way your timesheet are billed. The change will not affect already billed timesheets.")
                    }
                }

    @api.onchange('partner_id')
    def _onchange_partner_id(self):
        super(ProjectTask, self)._onchange_partner_id()
        if self.billable_type == 'task_rate':
            if self.sale_line_id.order_partner_id.commercial_partner_id != self.partner_id.commercial_partner_id:
                self.sale_line_id = False

    @api.multi
    @api.constrains('sale_line_id')
    def _check_sale_line_type(self):
        for task in self.sudo():
            if task.sale_line_id:
                if not task.sale_line_id.is_service or task.sale_line_id.is_expense:
                    raise ValidationError(_('You cannot link the order item %s - %s to this task because it is a re-invoiced expense.' % (task.sale_line_id.order_id.id, task.sale_line_id.product_id.name)))

    @api.multi
    def write(self, values):
        if values.get('project_id'):
            project_dest = self.env['project.project'].browse(values['project_id'])
            if project_dest.billable_type == 'employee_rate':
                values['sale_line_id'] = False
            if project_dest.billable_type == 'project_rate':
                values['sale_line_id'] = project_dest.sale_line_id.id
        return super(ProjectTask, self).write(values)

    @api.multi
    def unlink(self):
        if any(task.sale_line_id for task in self):
            raise ValidationError(_('You have to unlink the task from the sale order item in order to delete it.'))
        return super(ProjectTask, self).unlink()

    # ---------------------------------------------------
    # Subtasks
    # ---------------------------------------------------

    @api.model
    def _subtask_implied_fields(self):
        result = super(ProjectTask, self)._subtask_implied_fields()
        return result + ['sale_line_id']

    def _subtask_write_values(self, values):
        result = super(ProjectTask, self)._subtask_write_values(values)
        # changing the partner on a task will reset the sale line of its subtasks
        if 'partner_id' in result:
            result['sale_line_id'] = False
        elif 'sale_line_id' in result:
            result.pop('sale_line_id')
        return result

    # ---------------------------------------------------
    # Actions
    # ---------------------------------------------------

    @api.multi
    def action_view_so(self):
        self.ensure_one()
        return {
            "type": "ir.actions.act_window",
            "res_model": "sale.order",
            "views": [[False, "form"]],
            "res_id": self.sale_order_id.id,
            "context": {"create": False, "show_sale": True},
        }

    def rating_get_partner_id(self):
        partner = self.partner_id or self.sale_line_id.order_id.partner_id
        if partner:
            return partner
        return super(ProjectTask, self).rating_get_partner_id()
