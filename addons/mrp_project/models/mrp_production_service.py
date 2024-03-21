# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api, fields, _

class MrpProductionService(models.Model):
    _name = 'mrp.production.service'
    _order = "sequence, id"
    _rec_name = "product_id"
    _description = 'Production Service'
    _check_company_auto = True

    def _get_default_product_uom_id(self):
        return self.env['uom.uom'].search([], limit=1, order='id').id

    product_id = fields.Many2one('product.product', 'Service', required=True, check_company=True, domain=[('product_tmpl_id.type', '=', 'service')])
    product_tmpl_id = fields.Many2one('product.template', 'Product Template', related='product_id.product_tmpl_id', store=True, index=True)
    company_id = fields.Many2one(related='production_id.company_id', store=True, index=True, readonly=True)
    product_qty = fields.Float('Demand Quantity', default=1.0, digits='Product Unit of Measure', required=True)
    qty_delivered = fields.Float('Quantity Delivered', digits='Product Unit of Measure', compute='_compute_qty_delivered', store=True, readonly=False, copy=False)
    product_uom_id = fields.Many2one(
        'uom.uom', 'Product Unit of Measure',
        default=_get_default_product_uom_id,
        required=True,
        help="Unit of Measure (Unit of Measure) is the unit of measurement for the inventory control",
        domain="[('category_id', '=', product_uom_category_id)]")
    product_uom_category_id = fields.Many2one(related='product_id.uom_id.category_id')
    sequence = fields.Integer('Sequence', default=1, help="Gives the sequence order when displaying.")
    production_id = fields.Many2one('mrp.production', 'Production', index=True, ondelete='cascade', required=True)
    bom_line_id = fields.Many2one('mrp.bom.line')

    qty_delivered_method = fields.Selection(
        selection=[
            ('manual', "Manual"),
            ('milestones', 'Milestones')
        ],
        string="Method to update delivered qty",
        compute='_compute_qty_delivered_method',
        store=True, precompute=True,
        help="According to product configuration, the delivered quantity can be automatically computed by mechanism:\n"
             "  - Manual: the quantity is set manually on the line\n"
             "  - Analytic From expenses: the quantity is the quantity sum from posted expenses\n"
             "  - Timesheet: the quantity is the sum of hours recorded on tasks linked to this sale line\n"
             "  - Stock Moves: the quantity comes from confirmed pickings\n")
    project_id = fields.Many2one('project.project', 'Generated Project', index=True, copy=False)
    task_id = fields.Many2one('project.task', 'Generated Task', index=True, copy=False)
    # used to know if generate a task and/or a project, depending on the product settings
    reached_milestones_ids = fields.One2many('project.milestone', 'production_service_id', string='Reached Milestones', domain=[('is_reached', '=', True)])

    @api.depends('product_id')
    def _compute_qty_delivered_method(self):
        milestones_lines = self.filtered(lambda mos: mos.product_id.service_type == 'milestones')
        milestones_lines.qty_delivered_method = 'milestones'
        (self - milestones_lines).qty_delivered_method = 'manual'

    @api.depends('qty_delivered_method', 'product_qty', 'reached_milestones_ids.quantity_percentage')
    def _compute_qty_delivered(self):
        lines_by_milestones = self.filtered(lambda mos: mos.qty_delivered_method == 'milestones')
        if not lines_by_milestones:
            return

        project_milestone_read_group = self.env['project.milestone']._read_group(
            [('production_service_id', 'in', lines_by_milestones.ids), ('is_reached', '=', True)],
            ['production_service_id'],
            ['quantity_percentage:sum'],
        )
        reached_milestones_per_service = {service.id: percentage_sum for service, percentage_sum in project_milestone_read_group}
        for line in lines_by_milestones:
            mos_id = line.id or line._origin.id
            line.qty_delivered = reached_milestones_per_service.get(mos_id, 0.0) * line.product_qty

    @api.model_create_multi
    def create(self, vals_list):
        services = super().create(vals_list)
        for service in services:
            if service.production_id.state != 'draft':
                has_task = bool(service.task_id)
                service.sudo()._timesheet_service_generation()
                # if the MO service created a task, post a message on the order
                if service.task_id and not has_task:
                    msg_body = _("Task Created (%s): %s", service.product_id.name, service.task_id._get_html_link())
                    service.production_id.message_post(body=msg_body)

        # Set a production service on the project, if any is given
        if project_id := self.env.context.get('link_to_project'):
            service_line = next((line for line in services), False)
            assert service_line
            project = self.env['project.project'].browse(project_id)
            if not project.production_service_id:
                project.production_service_id = service_line
        return services

    def write(self, values):
        result = super().write(values)
        # changing the ordered quantity should change the allocated hours on the
        # task, whatever the MO state. It will be blocked by the super in case
        # of a locked manufacturing order.
        if 'product_qty' in values and not self.env.context.get('no_update_allocated_hours', False):
            for line in self:
                if line.task_id:
                    allocated_hours = line._convert_qty_company_hours(line.task_id.company_id or self.env.user.company_id)
                    line.task_id.write({'allocated_hours': allocated_hours})
        return result

    @api.onchange('product_uom_id')
    def onchange_product_uom_id(self):
        res = {}
        if not self.product_uom_id or not self.product_id:
            return res
        if self.product_uom_id.category_id != self.product_id.uom_id.category_id:
            self.product_uom_id = self.product_id.uom_id.id
            res['warning'] = {'title': _('Warning'), 'message': _('The Product Unit of Measure you chose has a different category than in the product form.')}
        return res

    @api.onchange('product_id')
    def onchange_product_id(self):
        if self.product_id:
            self.product_uom_id = self.product_id.uom_id.id

    ###########################################
    # Service : Project and task generation
    ###########################################

    def _convert_qty_company_hours(self, dest_company):
        return self.product_qty

    def _timesheet_create_project_prepare_values(self):
        """Generate project values"""
        service_products = self.production_id.service_ids.product_id.filtered(
            lambda p: p.type == 'service' and p.default_code)
        default_code = service_products.default_code if len(service_products) == 1 else None

        name = self.production_id.name
        if default_code:
            name = default_code + ": " + name
        plan = self.env['account.analytic.plan'].sudo().search([], limit=1)
        if not plan:
            plan = self.env['account.analytic.plan'].sudo().create({
                'name': 'Default',
            })
        account = self.env['account.analytic.account'].create({
            'name': name,
            'company_id': self.company_id.id,
            'plan_id': plan.id,
        })
        self.production_id.analytic_distribution = {account.id: 100}
        # create the project or duplicate one
        return {
            'name': self.production_id.name,
            'analytic_account_id': account.id,
            'production_service_id': self.id,
            'active': True,
            'company_id': self.company_id.id,
            'user_id': False,
        }

    def _timesheet_create_project(self):
        """ Generate project for the given mo service, and link it.
            :param project: record of project.project in which the task should be created
            :return task: record of the created task
        """
        self.ensure_one()
        values = self._timesheet_create_project_prepare_values()
        if self.product_id.project_template_id:
            values['name'] = "%s - %s" % (values['name'], self.product_id.project_template_id.name)
            # The no_create_folder context key is used in documents_project
            project = self.product_id.project_template_id.with_context(no_create_folder=True).copy(values)
            project.tasks.write({
                'production_service_id': self.id,
            })
            # duplicating a project doesn't set the SO on sub-tasks
            project.tasks.filtered('parent_id').write({
                'production_service_id': self.id,
                'production_id': self.production_id.id,
            })
        else:
            project_only_mol_count = self.env['mrp.production.service'].search_count([
                ('production_id', '=', self.production_id.id),
                ('product_id.service_tracking', 'in', ['project_only', 'task_in_project']),
            ])
            if project_only_mol_count == 1:
                values['name'] = "%s - [%s] %s" % (values['name'], self.product_id.default_code, self.product_id.name) if self.product_id.default_code else "%s - %s" % (values['name'], self.product_id.name)
            # The no_create_folder context key is used in documents_project
            project = self.env['project.project'].with_context(no_create_folder=True).create(values)

        # Avoid new tasks to go to 'Undefined Stage'
        if not project.type_ids:
            project.type_ids = self.env['project.task.type'].create([{
                'name': name,
                'fold': fold,
                'sequence': sequence,
            } for name, fold, sequence in [
                (_('To Do'), False, 5),
                (_('In Progress'), False, 10),
                (_('Done'), True, 15),
                (_('Cancelled'), True, 20),
            ]])

        # link project as generated by current mo service line
        self.write({'project_id': project.id})
        return project

    def _timesheet_create_task_prepare_values(self, project):
        self.ensure_one()
        allocated_hours = 0.0
        if self.product_id.service_type not in ['milestones', 'manual']:
            allocated_hours = self._convert_qty_company_hours(self.company_id)
        return {
            'name': self.product_id.name if project.production_service_id else '%s - %s' % (self.production_id.name or '', self.product_id.name),
            'analytic_account_id': project.analytic_account_id.id,
            'allocated_hours': allocated_hours,
            'project_id': project.id,
            'production_service_id': self.id,
            'production_id': self.production_id.id,
            'company_id': project.company_id.id,
            'user_ids': False,  # force non assigned task, as created as sudo()
        }

    def _timesheet_create_task(self, project):
        """ Generate task for the given mo service line, and link it.
            :param project: record of project.project in which the task should be created
            :return task: record of the created task
        """
        values = self._timesheet_create_task_prepare_values(project)
        task = self.env['project.task'].sudo().create(values)
        self.write({'task_id': task.id})
        # post message on task
        task_msg = _("This task has been created from: %s (%s)",
            self.production_id._get_html_link(),
            self.product_id.name
        )
        task.message_post(body=task_msg)
        return task

    def _timesheet_service_generation(self):
        """ For service lines, create the task or the project. If already exists, it simply links
            the existing one to the line.
            Note: If the MO was confirmed, cancelled, set to draft then confirmed, avoid creating a
            new project/task. This explains the searches on 'production_service_id' on project/task. This also
            implied if mo service of generated task has been modified, we may regenerate it.
        """
        mo_service_task_global_project = self.filtered(lambda mos: mos.product_id.service_tracking == 'task_global_project')
        mo_service_new_project = self.filtered(lambda mos: mos.product_id.service_tracking in ['project_only', 'task_in_project'])

        # search mo services from MO of current mo services having their project generated, in order to check if the current one can
        # create its own project, or reuse the one of its order.
        map_mo_project = {}
        if mo_service_new_project:
            production_ids = self.mapped('production_id').ids
            mo_services_with_project = self.search([('production_id', 'in', production_ids), ('project_id', '!=', False), ('product_id.service_tracking', 'in', ['project_only', 'task_in_project']), ('product_id.project_template_id', '=', False)])
            map_mo_project = {mos.production_id.id: mos.production_id for mos in mo_services_with_project}
            mo_services_with_project_templates = self.search([('production_id', 'in', production_ids), ('project_id', '!=', False), ('product_id.service_tracking', 'in', ['project_only', 'task_in_project']), ('product_id.project_template_id', '!=', False)])
            map_mo_project_templates = {(mos.production_id.id, mos.product_id.project_template_id.id): mos.project_id for mos in mo_services_with_project_templates}

        # search the global project of current MO services, in which create their task
        map_mos_project = {}
        if mo_service_task_global_project:
            map_mos_project = {mos.id: mos.product_id.with_company(mos.company_id).project_id for mos in mo_service_task_global_project}

        def _can_create_project(mos):
            if not mos.project_id:
                if mos.product_id.project_template_id:
                    return (mos.production_id.id, mos.product_id.project_template_id.id) not in map_mo_project_templates
                elif mos.production_id.id not in map_mo_project:
                    return True
            return False

        def _determine_project(mo_service):
            """Determine the project for this production service line.
            Rules are different based on the service_tracking:

            - 'project_only': the project_id can only come from the production service line itself
            - 'task_in_project': the project_id comes from the production service line only if no project_id was
            configured on the parent MO"""

            if mo_service.product_id.service_tracking == 'project_only':
                return mo_service.project_id
            elif mo_service.product_id.service_tracking == 'task_in_project':
                return mo_service.production_id.project_id or mo_service.project_id

            return False

        # task_global_project: create task in global project
        for mo_service in mo_service_task_global_project:
            if not mo_service.task_id:
                if map_mos_project.get(mo_service.id) and mo_service.product_qty > 0:
                    mo_service._timesheet_create_task(project=map_mos_project[mo_service.id])

        # project_only, task_in_project: create a new project, based or not on a template (1 per MO). May be create a task too.
        # if 'task_in_project' and project_id configured on MO, use that one instead
        for mo_service in mo_service_new_project:
            project = _determine_project(mo_service)
            if not project and _can_create_project(mo_service):
                project = mo_service._timesheet_create_project()
                if mo_service.product_id.project_template_id:
                    map_mo_project_templates[(mo_service.production_id.id, mo_service.product_id.project_template_id.id)] = project
                else:
                    map_mo_project[mo_service.production_id.id] = project
            elif not project:
                # Attach subsequent MO services to the created project
                mo_service.project_id = (
                    map_mo_project_templates.get((mo_service.production_id.id, mo_service.product_id.project_template_id.id))
                    or map_mo_project.get(mo_service.production_id.id)
                )
            if mo_service.product_id.service_tracking == 'task_in_project':
                if not project:
                    if mo_service.product_id.project_template_id:
                        project = map_mo_project_templates[(mo_service.production_id.id, mo_service.product_id.project_template_id.id)]
                    else:
                        project = map_mo_project[mo_service.production_id.id]
                if not mo_service.task_id:
                    mo_service._timesheet_create_task(project=project)
            mo_service._handle_milestones(project)

    def _handle_milestones(self, project):
        self.ensure_one()
        if self.product_id.service_type != 'milestones':
            return
        if (milestones := project.milestone_ids.filtered(lambda milestone: not milestone.production_service_id)):
            milestones.write({
                'production_service_id': self.id,
                'product_uom_qty': self.product_uom_qty / len(milestones),
            })
        else:
            milestone = self.env['project.milestone'].create({
                'name': self.product_id.name,
                'project_id': self.project_id.id or self.production_id.project_id.id,
                'production_service_id': self.id,
                'quantity_percentage': 1,
            })
            if self.product_id.service_tracking == 'task_in_project':
                self.task_id.milestone_id = milestone.id
