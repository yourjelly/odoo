import ast
from dateutil.relativedelta import relativedelta
from odoo import api, fields, models, _
from odoo.exceptions import UserError


class ProjectTaskType(models.Model):
    _inherit = 'project.task.type'

    done = fields.Boolean('Request Done')
    is_maintenance_task_type = fields.Boolean(default=False, readonly=True)

    @api.model_create_multi
    def create(self, vals_list):
        if self.env.context.get('default_is_maintenance_task_type'):
            for vals in vals_list:
                vals['is_maintenance_task_type'] = True
        return super().create(vals_list)


class MaintenanceEquipmentCategory(models.Model):
    _name = 'maintenance.equipment.category'
    _inherit = ['mail.alias.mixin', 'mail.thread']
    _description = 'Maintenance Equipment Category'

    @api.depends('equipment_ids')
    def _compute_fold(self):
        # fix mutual dependency: 'fold' depends on 'equipment_count', which is
        # computed with a read_group(), which retrieves 'fold'!
        self.fold = False
        for category in self:
            category.fold = False if category.equipment_count else True

    name = fields.Char('Category Name', required=True, translate=True)
    company_id = fields.Many2one('res.company', string='Company',
        default=lambda self: self.env.company)
    technician_user_id = fields.Many2one('res.users', 'Responsible', tracking=True, default=lambda self: self.env.uid)
    color = fields.Integer('Color Index')
    note = fields.Html('Comments', translate=True)
    equipment_ids = fields.One2many('maintenance.equipment', 'category_id', string='Equipment', copy=False)
    equipment_count = fields.Integer(string="Equipment Count", compute='_compute_equipment_count')
    task_ids = fields.One2many('project.task', 'category_id', copy=False, domain="[('is_maintenance_task', '=', True)]")
    task_count = fields.Integer(string="Maintenance Count", compute='_compute_task_count')
    task_open_count = fields.Integer(string="Current Maintenance", compute='_compute_task_count')
    alias_id = fields.Many2one(help="Email alias for this equipment category. New emails will automatically "
        "create a new equipment under this category.")
    fold = fields.Boolean(string='Folded in Maintenance Pipe', compute='_compute_fold', store=True)

    def _compute_equipment_count(self):
        equipment_data = self.env['maintenance.equipment']._read_group([('category_id', 'in', self.ids)], ['category_id'], ['__count'])
        mapped_data = {category.id: count for category, count in equipment_data}
        for category in self:
            category.equipment_count = mapped_data.get(category.id, 0)

    def _compute_task_count(self):
        maintenance_data = self.env['project.task']._read_group([('is_maintenance_task', '=', True), ('category_id', 'in', self.ids)], ['category_id', 'active'], ['__count'])
        mapped_data = {(category.id, active): count for category, active, count in maintenance_data}
        for category in self:
            category.task_open_count = mapped_data.get((category.id, True), 0)
            category.task_count = category.task_open_count + mapped_data.get((category.id, False), 0)

    @api.ondelete(at_uninstall=False)
    def _unlink_except_contains_tasks(self):
        for category in self:
            if category.equipment_ids or category.task_ids:
                raise UserError(_("You cannot delete an equipment category containing equipment or maintenance requests."))

    def _alias_get_creation_values(self):
        values = super(MaintenanceEquipmentCategory, self)._alias_get_creation_values()
        values['alias_model_id'] = self.env['ir.model']._get('project.task').id
        if self.id:
            values['alias_defaults'] = defaults = ast.literal_eval(self.alias_defaults or "{}")
            defaults['category_id'] = self.id
        return values


class MaintenanceMixin(models.AbstractModel):
    _name = 'maintenance.mixin'
    _check_company_auto = True
    _description = 'Maintenance Maintained Item'

    company_id = fields.Many2one('res.company', string='Company',
        default=lambda self: self.env.company)
    effective_date = fields.Date('Effective Date', default=fields.Date.context_today, required=True, help="This date will be used to compute the Mean Time Between Failure.")
    project_id = fields.Many2one('project.project', string='Maintenance Team', compute='_compute_project_id', store=True, readonly=False, check_company=True)
    technician_user_id = fields.Many2one('res.users', string='Technician', tracking=True)
    task_ids = fields.One2many('project.task')  # needs to be extended in order to specify inverse_name !
    task_count = fields.Integer(compute='_compute_task_count', string="Maintenance Count", store=True)
    task_open_count = fields.Integer(compute='_compute_task_count', string="Current Maintenance", store=True)
    expected_mtbf = fields.Integer(string='Expected MTBF', help='Expected Mean Time Between Failure')
    mtbf = fields.Integer(compute='_compute_task', string='MTBF', help='Mean Time Between Failure, computed based on done corrective maintenances.')
    mttr = fields.Integer(compute='_compute_task', string='MTTR', help='Mean Time To Repair')
    estimated_next_failure = fields.Date(compute='_compute_task', string='Estimated time before next failure (in days)', help='Computed as Latest Failure Date + MTBF')
    latest_failure_date = fields.Date(compute='_compute_task', string='Latest Failure Date')

    @api.depends('company_id')
    def _compute_project_id(self):
        for record in self:
            if record.project_id.company_id and record.project_id.company_id.id != record.company_id.id:
                record.project_id = False

    @api.depends('effective_date', 'task_ids.stage_id', 'task_ids.close_date', 'task_ids.request_date')
    def _compute_task(self):
        for record in self:
            tasks = record.task_ids.filtered(lambda mr: mr.is_maintenance_task and mr.maintenance_type == 'corrective' and mr.stage_id.done)
            record.mttr = len(tasks) and (sum(int((request.close_date - request.request_date).days) for request in tasks) / len(tasks)) or 0
            record.latest_failure_date = max((request.request_date for request in tasks), default=False)
            record.mtbf = record.latest_failure_date and (record.latest_failure_date - record.effective_date).days / len(tasks) or 0
            record.estimated_next_failure = record.mtbf and record.latest_failure_date + relativedelta(days=record.mtbf) or False

    @api.depends('task_ids.stage_id.done', 'task_ids.active')
    def _compute_task_count(self):
        for record in self:
            record.task_count = len(record.task_ids)
            record.task_open_count = len(record.task_ids.filtered(lambda mr: mr.is_maintenance_task and not mr.stage_id.done and mr.active))


class MaintenanceEquipment(models.Model):
    _name = 'maintenance.equipment'
    _inherit = ['mail.thread', 'mail.activity.mixin', 'maintenance.mixin']
    _description = 'Maintenance Equipment'
    _check_company_auto = True

    def _track_subtype(self, init_values):
        self.ensure_one()
        if 'owner_user_id' in init_values and self.owner_user_id:
            return self.env.ref('maintenance.mt_mat_assign')
        return super(MaintenanceEquipment, self)._track_subtype(init_values)

    @api.depends('serial_no')
    def _compute_display_name(self):
        for record in self:
            if record.serial_no:
                record.display_name = record.name + '/' + record.serial_no
            else:
                record.display_name = record.name

    name = fields.Char('Equipment Name', required=True, translate=True)
    active = fields.Boolean(default=True)
    owner_user_id = fields.Many2one('res.users', string='Owner', tracking=True)
    category_id = fields.Many2one('maintenance.equipment.category', string='Equipment Category',
                                  tracking=True, group_expand='_read_group_category_ids')
    partner_id = fields.Many2one('res.partner', string='Vendor', check_company=True)
    partner_ref = fields.Char('Vendor Reference')
    location = fields.Char('Location')
    model = fields.Char('Model')
    serial_no = fields.Char('Serial Number', copy=False)
    assign_date = fields.Date('Assigned Date', tracking=True)
    cost = fields.Float('Cost')
    note = fields.Html('Note')
    warranty_date = fields.Date('Warranty Expiration Date')
    color = fields.Integer('Color Index')
    scrap_date = fields.Date('Scrap Date')
    task_ids = fields.One2many('project.task', 'equipment_id')
    customer_id = fields.Many2one('res.partner', check_company=True)

    @api.onchange('category_id')
    def _onchange_category_id(self):
        self.technician_user_id = self.category_id.technician_user_id

    _sql_constraints = [
        ('serial_no', 'unique(serial_no)', "Another asset already exists with this serial number!"),
    ]

    @api.model_create_multi
    def create(self, vals_list):
        equipments = super().create(vals_list)
        for equipment in equipments:
            if equipment.owner_user_id:
                equipment.message_subscribe(partner_ids=[equipment.owner_user_id.partner_id.id])
        return equipments

    def write(self, vals):
        if vals.get('owner_user_id'):
            self.message_subscribe(partner_ids=self.env['res.users'].browse(vals['owner_user_id']).partner_id.ids)
        return super(MaintenanceEquipment, self).write(vals)

    @api.model
    def _read_group_category_ids(self, categories, domain):
        """ Read group customization in order to display all the categories in
            the kanban view, even if they are empty.
        """
        # bypass ir.model.access checks, but search with ir.rules
        search_domain = self.env['ir.rule']._compute_domain(categories._name)
        category_ids = categories.sudo()._search(search_domain, order=categories._order)
        return categories.browse(category_ids)
