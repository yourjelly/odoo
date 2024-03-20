# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api, _, _lt
from odoo.osv import expression
from odoo.tools import Query, SQL


class Project(models.Model):
    _inherit = 'project.project'

    production_service_id = fields.Many2one(
        'mrp.production.service', 'MO Service Line', copy=False, store=True, readonly=False, index='btree_not_null',
        help="MO service item that will be selected by default on the tasks and timesheets of this project,"
            " except if the employee set on the timesheets is explicitely linked to another MO service item on the project.\n"
            "It can be modified on each task and timesheet entry individually if necessary.")
    production_id = fields.Many2one(string='Manufacturing Order', related='production_service_id.production_id', help="MO to which the project is linked.")
    # FIXME clpi - very broken as this shadows the field in project_mrp leading to weird behaviour.
    production_count = fields.Integer(compute='_compute_production_count', groups='mrp.group_mrp_user')
    production_service_count = fields.Integer(compute='_compute_production_count', groups='mrp.group_mrp_user')
    production_state = fields.Selection(related='production_id.state')


    @api.model
    def _map_tasks_default_values(self, task, project):
        defaults = super()._map_tasks_default_values(task, project)
        defaults['production_service_id'] = False
        return defaults

    @api.depends('production_id', 'task_ids.production_id')
    def _compute_production_count(self):
        productions_per_project_id = self._fetch_productions_per_project_id({'project.task': [('state', 'in', self.env['project.task'].OPEN_STATES)]})
        for project in self:
            service_lines = productions_per_project_id.get(project.id, self.env['mrp.production.service'])
            project.production_service_count = len(service_lines)
            project.production_count = len(service_lines.production_id)

    def action_view_mo_services(self):
        self.ensure_one()
        all_production_services = self._fetch_productions({'project.task': [('state', 'in', self.env['project.task'].OPEN_STATES)]})
        action_window = {
            'type': 'ir.actions.act_window',
            'res_model': 'mrp.production.service',
            'name': _("%(name)s's Manufacturing Order Services", name=self.name),
            'context': {
                'link_to_project': self.id,
                'form_view_ref': 'sale_project.sale_order_line_view_form_editable',  # Necessary for some logic in the form view
                'default_company_id': self.company_id.id,
                'default_production_id': self.production_id.id,
            },
            'views': [(self.env.ref('sale_project.sale_order_line_view_form_editable').id, 'form')],
        }
        if len(all_production_services) <= 1:
            action_window['res_id'] = all_production_services.id
        else:
            action_window.update({
                'domain': [('id', 'in', all_production_services.ids)],
                'views': [
                    (self.env.ref('sale_project.view_order_line_tree_with_create').id, 'tree'),
                    (self.env.ref('sale_project.sale_order_line_view_form_editable').id, 'form'),
                ],
            })
        return action_window

    def action_view_mos(self):
        self.ensure_one()
        all_productions = self._fetch_productions({'project.task': [('state', 'in', self.env['project.task'].OPEN_STATES)]}).production_id
        action_window = {
            "type": "ir.actions.act_window",
            "res_model": "mrp.production",
            'name': _("%(name)s's Manufacturing Orders", name=self.name),
            "context": {"create": self.env.context.get('create_for_project_id')},
        }
        if len(all_productions) <= 1:
            action_window.update({
                "res_id": all_productions.id,
                "views": [[False, "form"]],
            })
        else:
            action_window.update({
                "domain": [('id', 'in', all_productions.ids)],
                "views": [[False, "tree"], [False, "kanban"], [False, "calendar"], [False, "pivot"],
                           [False, "graph"], [False, "activity"], [False, "form"]],
            })
        return action_window

    def _fetch_productions_per_project_id(self, domain_per_model=None):
        if not self:
            return {}
        if len(self) == 1:
            return {self.id: self._fetch_productions(domain_per_model)}
        query_str, params = self._get_productions_query(domain_per_model).select('id', 'ARRAY_AGG(DISTINCT manufacturing_service_id) AS manufacturing_service_ids')
        query = f"""
            {query_str}
            GROUP BY id
        """
        self._cr.execute(query, params)
        return {row['id']: self.env['mrp.production.service'].browse(row['production_service_ids']) for row in self._cr.dictfetchall()}

    def _fetch_productions(self, domain_per_model=None, limit=None, offset=None):
        return self.env['mrp.production.service'].browse(self._fetch_production_ids(domain_per_model, limit, offset))

    def _fetch_production_ids(self, domain_per_model=None, limit=None, offset=None):
        if not self:
            return []
        query = self._get_productions_query(domain_per_model)
        query.limit = limit
        query.offset = offset
        rows = self.env.execute_query(query.select('DISTINCT production_service_id'))
        return [row[0] for row in rows]

    def _get_productions_query(self, domain_per_model=None):
        if domain_per_model is None:
            domain_per_model = {}
        project_domain = [('id', 'in', self.ids), ('production_service_id', '!=', False)]
        if 'project.project' in domain_per_model:
            project_domain = expression.AND([
                domain_per_model['project.project'],
                project_domain,
            ])
        project_query = self.env['project.project']._where_calc(project_domain)
        self._apply_ir_rules(project_query, 'read')
        project_sql = project_query.select('id', 'production_service_id')

        Task = self.env['project.task']
        task_domain = [('project_id', 'in', self.ids), ('production_service_id', '!=', False)]
        if Task._name in domain_per_model:
            task_domain = expression.AND([
                domain_per_model[Task._name],
                task_domain,
            ])
        task_query = Task._where_calc(task_domain)
        Task._apply_ir_rules(task_query, 'read')
        task_sql = task_query.select(f'{Task._table}.project_id AS id', f'{Task._table}.production_service_id')

        ProjectMilestone = self.env['project.milestone']
        milestone_domain = [('project_id', 'in', self.ids), ('production_service_id', '!=', False)]
        if ProjectMilestone._name in domain_per_model:
            milestone_domain = expression.AND([
                domain_per_model[ProjectMilestone._name],
                milestone_domain,
            ])
        milestone_query = ProjectMilestone._where_calc(milestone_domain)
        ProjectMilestone._apply_ir_rules(milestone_query)
        milestone_sql = milestone_query.select(
            f'{ProjectMilestone._table}.project_id AS id',
            f'{ProjectMilestone._table}.production_service_id',
        )

        return Query(self.env, 'project_production', SQL('(%s)', SQL(' UNION ').join([
            project_sql, task_sql, milestone_sql,
        ])))

    def _get_stat_buttons(self):
        buttons = super()._get_stat_buttons()
        if self.env.user.has_group('mrp.group_mrp_user'):
            self_sudo = self.sudo()
            buttons.append({
                'icon': 'dollar',
                'text': _lt('Manufacturing Orders'),
                'number': self_sudo.production_count,
                'action_type': 'object',
                'action': 'action_view_mos',
                'show': self_sudo.production_count > 0,
                'sequence': 64,
            })
            buttons.append({
                'icon': 'dollar',
                'text': _lt('Manufacturing Order Services'),
                'number': self.production_service_count,
                'action_type': 'object',
                'action': 'action_view_sols',
                'show': True,
                'sequence': 65,
            })
        return buttons

    def _get_profitability_items(self, with_action=True):
        res = super()._get_profitability_items(with_action)
        amount = 0
        for service in self._fetch_productions():
            amount += service.qty_delivered * service.product_id.list_price  # TODO clpi - UoM + currency conversion here
        if amount:
            mo_items = list(filter(lambda item: item['id'] == 'manufacturing_order', res['costs']['data']))
            if mo_items:
                mo_items[0]['billed'] += amount
                res['costs']['total']['billed'] += amount
            else:
                mrp_costs = {
                    'id': 'manufacturing_order',
                    'sequence': self._get_profitability_sequence_per_invoice_type()['manufacturing_order'],
                    'billed': amount,
                    'to_bill': 0.0,
                    'action': {'name': 'action_view_mos', 'type': 'object'},  # FIXME clpi - we now have 2 different MO view actions and 2 different ways to link MO to project. We should harmonize this somehow.
                }
                costs = res['costs']
                costs['data'].append(mrp_costs)
                costs['total']['billed'] += mrp_costs['billed']
        return res
