# Part of Odoo. See LICENSE file for full copyright and licensing details.
import ast
from collections import defaultdict

from odoo import models, fields, api, Command, _
from odoo.osv.expression import AND
from odoo.tools import float_round


class MrpProduction(models.Model):
    _name = 'mrp.production'
    _inherit = 'mrp.production'

    service_ids = fields.One2many('mrp.production.service', 'production_id', 'Services', copy=True, store=True, readonly=False, compute='_compute_service_ids')
    tasks_ids = fields.Many2many('project.task', compute='_compute_tasks_ids', search='_search_tasks_ids', string='Tasks associated with this production')
    tasks_count = fields.Integer(string='Tasks', compute='_compute_tasks_ids', groups="project.group_project_user")

    visible_project = fields.Boolean('Display project', compute='_compute_visible_project', readonly=True)
    project_id = fields.Many2one('project.project', 'Project', help='Select a project on which tasks can be created.')
    project_ids = fields.Many2many('project.project', compute="_compute_project_ids", string='Projects', copy=False, groups="project.group_project_user", help="Projects used in this production order.")
    project_count = fields.Integer(string='Number of Projects', compute='_compute_project_ids', groups='project.group_project_user')
    milestone_count = fields.Integer(compute='_compute_milestone_count')
    is_product_milestone = fields.Boolean(compute='_compute_is_product_milestone')
    show_create_project_button = fields.Boolean(compute='_compute_show_project_and_task_button', groups='project.group_project_user')
    show_project_button = fields.Boolean(compute='_compute_show_project_and_task_button', groups='project.group_project_user')
    show_task_button = fields.Boolean(compute='_compute_show_project_and_task_button', groups='project.group_project_user')

    @api.depends('company_id', 'bom_id', 'product_id', 'product_qty', 'product_uom_id')
    def _compute_service_ids(self):
        for production in self:
            if production.state != 'draft':
                continue
            list_service_raw = [Command.link(service.id) for service in production.service_ids.filtered(lambda s: not s.bom_line_id)]
            if not production.bom_id and not production._origin.product_id:
                production.service_ids = list_service_raw
            if any(service.bom_line_id.bom_id != production.bom_id or service.bom_line_id._skip_bom_line(production.product_id)\
                for service in production.service_ids if service.bom_line_id):
                production.service_ids = [Command.clear()]
            if production.bom_id and production.product_id and production.product_qty > 0:
                # keep manual entries
                services_raw_values = production._get_services_raw_values()
                service_raw_dict = {service.bom_line_id.id: service for service in production.service_ids.filtered(lambda s: s.bom_line_id)}
                for service_raw_values in services_raw_values:
                    if service_raw_values['bom_line_id'] in service_raw_dict:
                        # update existing entries
                        list_service_raw += [Command.update(service_raw_dict[service_raw_values['bom_line_id']].id, service_raw_values)]
                    else:
                        # add new entries
                        list_service_raw += [Command.create(service_raw_values)]
                production.service_ids = list_service_raw
            else:
                production.service_ids = [Command.delete(service.id) for service in production.service_ids.filtered(lambda s: s.bom_line_id)]

    def _get_services_raw_values(self):
        services = []
        for production in self:
            if not production.bom_id:
                continue
            factor = production.product_uom_id._compute_quantity(production.product_qty, production.bom_id.product_uom_id) / production.bom_id.product_qty
            _boms, lines = production.bom_id.explode(production.product_id, factor, picking_type=production.bom_id.picking_type_id)
            for bom_line, line_data in lines:
                if bom_line.child_bom_id and bom_line.child_bom_id.type == 'phantom' or bom_line.product_id.type != 'service':
                    continue
                services.append({
                    'product_id': bom_line.product_id.id,
                    'product_qty': line_data['qty'],
                    'product_uom_id': bom_line.product_uom_id.id,
                    'bom_line_id': bom_line.id,
                })
        return services

    def action_confirm(self):
        """ On MO confirmation, some lines should generate a task or a project. """
        result = super().action_confirm()
        if len(self.company_id) == 1:
            # All orders are in the same company
            self.service_ids.sudo().with_company(self.company_id)._timesheet_service_generation()
        else:
            # Orders from different companies are confirmed together
            for order in self:
                order.service_ids.sudo().with_company(order.company_id)._timesheet_service_generation()
        return result

    def _update_raw_moves(self, factor):
        for service in self.service_ids:
            service.product_qty = float_round(service.product_qty * factor, precision_rounding=service.product_uom_id.rounding, rounding_method='UP')
        return super()._update_raw_moves(factor)

    def _compute_milestone_count(self):
        read_group = self.env['project.milestone']._read_group(
            [('production_service_id', 'in', self.service_ids.ids)],
            ['production_service_id'],
            ['__count'],
        )
        line_data = {service.id: count for service, count in read_group}
        for mo in self:
            mo.milestone_count = sum(line_data.get(service.id, 0) for service in mo.service_ids)

    def _compute_is_product_milestone(self):
        for mo in self:
            mo.is_product_milestone = mo.service_ids.product_id.filtered(lambda p: p.service_type == 'milestones')

    def _compute_show_project_and_task_button(self):
        is_project_manager = self.env.user.has_group('project.group_project_manager')
        show_button_ids = self.env['mrp.production.service']._read_group([
            ('production_id', 'in', self.ids),
            ('production_id.state', 'not in', ['draft']),
        ], aggregates=['production_id:array_agg'])[0][0]
        for mo in self:
            mo.show_project_button = mo.id in show_button_ids and mo.project_count
            mo.show_task_button = mo.show_project_button or mo.tasks_count
            mo.show_create_project_button = is_project_manager and mo.id in show_button_ids and not mo.project_count

    def _search_tasks_ids(self, operator, value):
        is_name_search = operator in ['=', '!=', 'like', '=like', 'ilike', '=ilike'] and isinstance(value, str)
        is_id_eq_search = operator in ['=', '!='] and isinstance(value, int)
        is_id_in_search = operator in ['in', 'not in'] and isinstance(value, list) and all(isinstance(item, int) for item in value)
        if not (is_name_search or is_id_eq_search or is_id_in_search):
            raise NotImplementedError(_('Operation not supported'))

        if is_name_search:
            tasks_ids = self.env['project.task']._name_search(value, operator=operator, limit=None)
        elif is_id_eq_search:
            tasks_ids = value if operator == '=' else self.env['project.task']._search([('id', '!=', value)], order='id')
        else:  # is_id_in_search
            tasks_ids = self.env['project.task']._search([('id', operator, value)], order='id')

        tasks = self.env['project.task'].browse(tasks_ids)
        return [('id', 'in', tasks.production_service_id.ids)]

    @api.depends('service_ids.product_id.project_id')
    def _compute_tasks_ids(self):
        tasks_per_mo = self.env['project.task']._read_group(
            domain=['&', ('project_id', '!=', False), '|', ('production_service_id', 'in', self.service_ids.ids), ('production_id', 'in', self.ids)],
            groupby=['production_id'],
            aggregates=['id:recordset', '__count']
        )
        mo_with_tasks = self.env['mrp.production']
        for mo, tasks_ids, tasks_count in tasks_per_mo:
            if mo:
                mo.tasks_ids = tasks_ids
                mo.tasks_count = tasks_count
                mo_with_tasks += mo
            else:
                # tasks that have no sale_order_id need to be associated with the SO from their sale_line_id
                for task in tasks_ids:
                    task_mo = task.production_service_id.order_id
                    task_mo.tasks_ids = [Command.link(task.id)]
                    task_mo.tasks_count += 1
                    mo_with_tasks += task_mo
        remaining_mos = self - mo_with_tasks
        if remaining_mos:
            remaining_mos.tasks_ids = [Command.clear()]
            remaining_mos.tasks_count = 0

    @api.depends('service_ids.product_id.service_tracking')
    def _compute_visible_project(self):
        """ Users should be able to select a project_id on the MO if at least one MO services line has a product with its service tracking
        configured as 'task_in_project' """
        for mo in self:
            mo.visible_project = any(
                service_tracking == 'task_in_project' for service_tracking in mo.service_ids.mapped('product_id.service_tracking')
            )

    @api.depends('service_ids.product_id', 'service_ids.project_id')
    def _compute_project_ids(self):
        is_project_manager = self.env.user.has_group('project.group_project_manager')
        projects = self.env['project.project'].search([('production_id', 'in', self.ids)])
        projects_per_mo = defaultdict(lambda: self.env['project.project'])
        for project in projects:
            projects_per_mo[project.production_id.id] |= project
        for production in self:
            projects = production.service_ids.mapped('product_id.project_id')
            projects |= production.service_ids.mapped('project_id')
            projects |= production.project_id
            projects |= projects_per_mo[production.id or production._origin.id]
            if not is_project_manager:
                projects = projects._filter_access_rules('read')
            production.project_ids = projects
            production.project_count = len(projects)

    @api.onchange('project_id')
    def _onchange_project_id(self):
        """ Set the MO analytic distribution to the selected project's analytic account """
        if self.project_id.analytic_account_id:
            self.analytic_distribution = {self.project_id.analytic_account_id.id: 100}

    def action_view_task(self):
        self.ensure_one()
        if not self.service_ids:
            return {'type': 'ir.actions.act_window_close'}

        list_view_id = self.env.ref('project.view_task_tree2').id
        form_view_id = self.env.ref('project.view_task_form2').id
        kanban_view_id = self.env.ref('project.view_task_kanban_inherit_view_default_project').id

        action = self.env["ir.actions.actions"]._for_xml_id("project.action_view_task")
        if self.tasks_count > 1:  # cross project kanban task
            action['views'] = [[kanban_view_id, 'kanban'], [list_view_id, 'tree'], [form_view_id, 'form'], [False, 'graph'], [False, 'calendar'], [False, 'pivot']]
        else:  # 1 or 0 tasks -> form view
            action['views'] = [(form_view_id, 'form')]
            action['res_id'] = self.tasks_ids.id
        # set default project
        default_line = next((mos for mos in self.service_ids), self.env['mrp.production.service'])
        default_project_id = default_line.project_id.id or self.project_id.id or self.project_ids[:1].id

        action['context'] = {
            'search_default_production_id': self.id,
            'default_production_id': self.id,
            'default_production_service_id': default_line.id,
            'default_project_id': default_project_id,
            'default_user_ids': [self.env.uid],
        }
        action['domain'] = AND([ast.literal_eval(action['domain']), [('id', 'in', self.tasks_ids.ids)]])
        return action

    def action_create_project(self):
        self.ensure_one()
        if not self.show_create_project_button:
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'type': 'danger',
                    'message': _("The project couldn't be created as the Manufacturing Order must be confirmed, is already linked to a project, or doesn't involve any services."),
                }
            }

        sorted_line = self.service_ids.sorted('sequence')
        default_service_line = next((mos for mos in sorted_line), self.env['mrp.production.service'])
        return {
            **self.env["ir.actions.actions"]._for_xml_id("project.open_create_project"),
            'context': {
                'default_production_id': self.id,
                'default_production_service_id': default_service_line.id,
                'default_user_ids': [self.env.uid],
                'default_company_id': self.company_id.id,
                'generate_milestone': default_service_line.product_id.service_type == 'milestones',
            },
        }

    def action_view_project_ids(self):
        self.ensure_one()
        if not self.service_ids:
            return {'type': 'ir.actions.act_window_close'}

        sorted_line = self.service_ids.sorted('sequence')
        default_service_line = next(mos for mos in sorted_line)
        action = {
            'type': 'ir.actions.act_window',
            'name': _('Projects'),
            'domain': ['|', ('production_id', '=', self.id), ('id', 'in', self.with_context(active_test=False).project_ids.ids), ('active', 'in', [True, False])],
            'res_model': 'project.project',
            'views': [(False, 'kanban'), (False, 'tree'), (False, 'form')],
            'view_mode': 'kanban,tree,form',
            'context': {
                **self._context,
                'default_production_service_id': default_service_line.id,
            }
        }
        if len(self.with_context(active_test=False).project_ids) == 1:
            action.update({'views': [(False, 'form')], 'res_id': self.project_ids.id})
        return action

    def action_view_milestone(self):
        self.ensure_one()
        default_project = self.project_ids and self.project_ids[0]
        sorted_line = self.service_ids.sorted('sequence')
        default_service_line = next(mos for mos in sorted_line if mos.product_id.service_type == 'milestones')
        return {
            'type': 'ir.actions.act_window',
            'name': _('Milestones'),
            'domain': [('production_service_id', 'in', self.service_ids.ids)],
            'res_model': 'project.milestone',
            'views': [(self.env.ref('sale_project.sale_project_milestone_view_tree').id, 'tree')],
            'view_mode': 'tree',
            'help': _("""
                <p class="o_view_nocontent_smiling_face">
                    No milestones found. Let's create one!
                </p><p>
                    Track major progress points that must be reached to achieve success.
                </p>
            """),
            'context': {
                **self.env.context,
                'default_project_id': default_project.id,
                'default_production_service_id': default_service_line.id,
            }
        }

    @api.model_create_multi
    def create(self, vals_list):
        created_records = super().create(vals_list)
        project = self.env['project.project'].browse(self.env.context.get('create_for_project_id'))
        if project:
            service = next((mos for mos in created_records.service_ids), False)
            if not project.production_service_id:
                project.production_service_id = service
        return created_records

    def write(self, values):
        if 'state' in values and values['state'] == 'cancel':
            self.project_id.sudo().production_service_id = False
        return super().write(values)
