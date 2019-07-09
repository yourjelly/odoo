# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError

from odoo.tools.safe_eval import safe_eval


class ProjectCreateSalesOrder(models.TransientModel):
    _name = 'project.create.sale.order'
    _description = "Create SO from project"

    @api.model
    def default_get(self, fields):
        result = super(ProjectCreateSalesOrder, self).default_get(fields)

        active_model = self._context.get('active_model')
        if active_model != 'project.project':
            raise UserError(_("You can only apply this action from a project."))

        active_id = self._context.get('active_id')
        if 'project_id' in fields and active_id:
            project = self.env['project.project'].browse(active_id)
            if project.billable_type != 'no':
                raise UserError(_("The project is already billable."))
            result['project_id'] = active_id
            result['partner_id'] = project.partner_id.id
        return result

    project_id = fields.Many2one('project.project', "Project", domain=[('sale_line_id', '=', False)], help="Project for which we are creating a sales order", required=True)
    partner_id = fields.Many2one('res.partner', string="Customer", domain=[('customer', '=', True)], help="Customer of the sales order")
    product_id = fields.Many2one('product.product', domain=[('type', '=', 'service'), ('invoice_policy', '=', 'delivery'), ('service_type', '=', 'timesheet')], string="Service", help="Product of the sales order item. Must be a service invoiced based on timesheets on tasks.")
    price_unit = fields.Float("Unit Price", help="Unit price of the sales order item.")
    currency_id = fields.Many2one('res.currency', string="Currency", related='product_id.currency_id', readonly=False)

    billable_type = fields.Selection([
        ('task_rate', 'At Task Rate'),
        ('project_rate', 'At Project Rate'),
        ('employee_rate', 'At Employee Rate'),
    ], string="Billing Type", default='task_rate', required=True, help="""
        * At Task Rate: All timesheets on the project will be billed at the rate defined on the task with its Sales Order Item.
        * At Project Rate: All timesheets on the project will be billed at the same rate.
        * At Employee Rate: Timesheets will be billed at a rate defined at employee level.
    """)

    line_ids = fields.One2many('project.create.sale.order.line', 'wizard_id', string='Lines')

    _sql_constraints = [
        ('partner_required_if_employee_rate', "CHECK((billable_type = 'employee_rate' AND partner_id IS NOT NULL) OR (billable_type != 'employee_rate'))", 'To create the sales order to bill the project at employee rate, a customer is needed.'),
        ('partner_required_if_project_rate', "CHECK((billable_type = 'project_rate' AND partner_id IS NOT NULL) OR (billable_type != 'project_rate'))", 'To create the sales order to bill the project at project rate, a customer is needed.'),
    ]

    @api.onchange('billable_type', 'product_id')
    def _onchange_product_id(self):
        if self.billable_type == 'task_rate':
            self.line_ids = False
            self.partner_id = False
        elif self.billable_type == 'project_rate':
            if self.product_id:
                self.price_unit = self.product_id.lst_price
            self.line_ids = False
        elif self.billable_type == 'employee_rate':
            self.price_unit = 0.0

    def action_make_billable(self):
        # check inputs
        self._check_user_inputs()
        # create the sale lines, the map (optional), and assign existing timesheet to sale lines
        if self.billable_type == 'task_rate':
            return self._make_billable_at_task_rate()
        if self.billable_type == 'project_rate':
            return self._make_billable_at_project_rate()
        elif self.billable_type == 'employee_rate':
            return self._make_billable_at_employee_rate()

    def _check_user_inputs(self):
        """ This method check is the asked user action is possible with the introduced data. This raises Error to
            explain why it is not possible. Return True otherwise.
            :raises UserError
        """
        # if project linked to SO line or at least on tasks with SO line, then we consider project as billable.
        if self.project_id.sale_line_id:
            raise UserError(_("The project is already linked to a sales order item."))

        if self.billable_type == 'employee_rate':
            # at least one line
            if not self.line_ids:
                raise UserError(_("At least one line should be filled."))

            # all employee having timesheet should be in the wizard map
            timesheet_employees = self.env['account.analytic.line'].search([('task_id', 'in', self.project_id.tasks.ids)]).mapped('employee_id')
            map_employees = self.line_ids.mapped('employee_id')
            missing_meployees = timesheet_employees - map_employees
            if missing_meployees:
                raise UserError(_('The Sales Order cannot be created because you did not enter some employees that entered timesheets on this project. Please list all the relevant employees before creating the Sales Order.\nMissing employee(s): %s') % (', '.join(missing_meployees.mapped('name'))))

        # check here if timesheet already linked to SO line
        timesheet_with_so_line = self.env['account.analytic.line'].search_count([('task_id', 'in', self.project_id.tasks.ids), ('so_line', '!=', False)])
        if timesheet_with_so_line:
            raise UserError(_('The sales order cannot be created because some timesheets of this project are already linked to another sales order.'))

        return True

    def _make_billable_at_task_rate(self):
        # update billable type of project
        self.project_id.write({
            'billable_type': 'task_rate',
        })
        # redirect to tasks of the project
        action = self.env.ref('project.act_project_project_2_project_task_all').read()[0]
        if action.get('context'):
            eval_context = self.env['ir.actions.actions']._get_eval_context()
            eval_context.update({'active_id': self.project_id.id})
            action['context'] = safe_eval(action['context'], eval_context)
        return action

    def _make_billable_at_project_rate(self):
        # update project before creating SO (partner required on SO)
        self.project_id.write({
            'partner_id': self.partner_id.id,
        })

        # create sales order
        sale_order = self.project_id._create_sale_order()

        # trying to simulate the SO line created a task, according to the product configuration
        # To avoid, generating a task when confirming the SO
        task_id = False
        if self.product_id.service_tracking in ['task_in_project', 'task_global_project']:
            task_id = self.env['project.task'].search([('project_id', '=', self.project_id.id)], order='create_date DESC', limit=1).id

        # create SO line
        sale_order_line = self.env['sale.order.line'].create({
            'order_id': sale_order.id,
            'product_id': self.product_id.id,
            'price_unit': self.price_unit,
            'project_id': self.project_id.id,  # prevent to re-create a project on confirmation
            'task_id': task_id,
            'product_uom_qty': 0.0,
        })

        # link the project and the tasks to the SO line
        self.project_id.write({
            'sale_order_id': sale_order.id,
            'sale_line_id': sale_order_line.id,
            'billable_type': 'project_rate',
        })
        self.project_id.tasks.filtered(lambda task: task.billable_type == 'no').write({
            'sale_line_id': sale_order_line.id,
            'partner_id': sale_order.partner_id.id,
            'email_from': sale_order.partner_id.email,
        })

        # assign SOL to timesheets
        self.env['account.analytic.line'].search([('task_id', 'in', self.project_id.tasks.ids), ('so_line', '=', False)]).write({
            'so_line': sale_order_line.id
        })

        return self._confirm_and_redirect_to_sale_order(sale_order)

    def _make_billable_at_employee_rate(self):
        # update project before creating SO (partner required on SO)
        self.project_id.write({
            'partner_id': self.partner_id.id,
        })

        # create sales order
        sale_order = self.project_id._create_sale_order()

        # trying to simulate the SO line created a task, according to the product configuration
        # To avoid, generating a task when confirming the SO
        task_id = self.env['project.task'].search([('project_id', '=', self.project_id.id)], order='create_date DESC', limit=1).id
        project_id = self.project_id.id

        non_billable_tasks = self.project_id.tasks.filtered(lambda task: task.billable_type == 'no')

        map_entries = self.env['project.sale.line.employee.map']
        EmployeeMap = self.env['project.sale.line.employee.map'].sudo()

        # create SO lines: create on SOL per product/price. So many employee can be linked to the same SOL
        map_product_price_sol = {}  # (product_id, price) --> SOL
        for wizard_line in self.line_ids:
            map_key = (wizard_line.product_id.id, wizard_line.price_unit)
            if map_key not in map_product_price_sol:
                values = {
                    'order_id': sale_order.id,
                    'product_id': wizard_line.product_id.id,
                    'price_unit': wizard_line.price_unit,
                    'product_uom_qty': 0.0,
                }
                if wizard_line.product_id.service_tracking in ['task_in_project', 'task_global_project']:
                    values['task_id'] = task_id
                if wizard_line.product_id.service_tracking in ['task_in_project', 'project_only']:
                    values['project_id'] = project_id

                sale_order_line = self.env['sale.order.line'].create(values)
                map_product_price_sol[map_key] = sale_order_line

            map_entries |= EmployeeMap.create({
                'project_id': self.project_id.id,
                'sale_line_id': map_product_price_sol[map_key].id,
                'employee_id': wizard_line.employee_id.id,
            })

        # link the project to the SO
        self.project_id.write({
            'sale_order_id': sale_order.id,
            'sale_line_id': sale_order.order_line[0].id,
            'partner_id': self.partner_id.id,
            'billable_type': 'employee_rate',
        })
        non_billable_tasks.write({
            'sale_line_id': sale_order.order_line[0].id,
            'partner_id': sale_order.partner_id.id,
            'email_from': sale_order.partner_id.email,
        })

        # assign SOL to timesheets
        for map_entry in map_entries:
            self.env['account.analytic.line'].search([('task_id', 'in', self.project_id.tasks.ids), ('employee_id', '=', map_entry.employee_id.id), ('so_line', '=', False)]).write({
                'so_line': map_entry.sale_line_id.id
            })

        return self._confirm_and_redirect_to_sale_order(sale_order)

    # --------------------------------------
    #  Helpers
    # --------------------------------------

    def _confirm_and_redirect_to_sale_order(self, sale_order):
        # confirm SO
        sale_order.action_confirm()

        view_form_id = self.env.ref('sale.view_order_form').id
        action = self.env.ref('sale.action_orders').read()[0]
        action.update({
            'views': [(view_form_id, 'form')],
            'view_mode': 'form',
            'name': sale_order.name,
            'res_id': sale_order.id,
        })
        return action


class ProjectCreateSalesOrderLine(models.TransientModel):
    _name = 'project.create.sale.order.line'
    _description = 'Create SO Line from project'
    _order = 'id,create_date'

    wizard_id = fields.Many2one('project.create.sale.order', required=True)
    product_id = fields.Many2one('product.product', domain=[('type', '=', 'service'), ('invoice_policy', '=', 'delivery'), ('service_type', '=', 'timesheet')], string="Service", required=True,
        help="Product of the sales order item. Must be a service invoiced based on timesheets on tasks.")
    price_unit = fields.Float("Unit Price", default=1.0, help="Unit price of the sales order item.")
    currency_id = fields.Many2one('res.currency', string="Currency", related='product_id.currency_id', readonly=False)
    employee_id = fields.Many2one('hr.employee', string="Employee", required=True, help="Employee that has timesheets on the project.")

    _sql_constraints = [
        ('unique_employee_per_wizard', 'UNIQUE(wizard_id, employee_id)', "An employee cannot be selected more than once in the mapping. Please remove duplicate(s) and try again."),
    ]

    @api.onchange('product_id')
    def _onchange_product_id(self):
        if self.product_id:
            self.price_unit = self.product_id.lst_price
