# -*- coding: utf-8 -*-

from openerp import api, fields, models
from openerp.exceptions import ValidationError


class HrEmployee(models.Model):
    _name = "hr.employee"
    _description = "Employee"
    _inherit = "hr.employee"

    @api.one
    def _contracts_count(self):
        self.contracts_count = self.env['hr.contract'].sudo().search_count([('employee_id', '=', self.id)])

    manager = fields.Boolean(string='Is a Manager')
    medic_exam = fields.Date(string='Medical Examination Date')
    place_of_birth = fields.Char(string='Place of Birth')
    children = fields.Integer(string='Number of Children')
    vehicle = fields.Char(string='Company Vehicle')
    vehicle_distance = fields.Integer(string='Home-Work Dist.', help='In kilometers')
    contract_ids = fields.One2many('hr.contract', 'employee_id', string='Contracts')
    contract_id = fields.Many2one('hr.contract', compute='_get_latest_contract', string='Current Contract', help='Latest contract of the employee')
    contracts_count = fields.Integer(compute='_contracts_count', string='Contracts')

    @api.one
    def _get_latest_contract(self):
        self.contract_id = self.env['hr.contract'].search([('employee_id', '=', self.id)], order='date_start', limit=1)


class HrContractType(models.Model):
    _name = 'hr.contract.type'
    _description = 'Contract Type'
    _order = 'sequence, id'

    name = fields.Char('Contract Type', required=True)
    sequence = fields.Integer('Sequence', help="Gives the sequence when displaying a list of Contract.", default=10)


class HrContract(models.Model):
    _name = 'hr.contract'
    _description = 'Contract'
    _inherit = ['mail.thread', 'ir.needaction_mixin']

    def _get_type(self):
        contract_type = self.env['hr.contract.type'].search([], limit=1)
        return contract_type.id

    name = fields.Char(string='Contract Reference', required=True)
    employee_id = fields.Many2one('hr.employee', string="Employee", required=True)
    department_id = fields.Many2one('hr.department', string="Department")
    type_id = fields.Many2one('hr.contract.type', string="Contract Type", required=True, default=_get_type)
    job_id = fields.Many2one('hr.job', string='Job Title')
    date_start = fields.Date(string='Start Date', required=True, default=fields.Date.context_today)
    date_end = fields.Date(string='End Date')
    trial_date_start = fields.Date(string='Trial Start Date')
    trial_date_end = fields.Date(string='Trial End Date')
    working_hours = fields.Many2one('resource.calendar', string='Working Schedule')
    wage = fields.Float(string='Wage', digits=(16, 2), required=True, help="Basic Salary of the employee")
    advantages = fields.Text(string='Advantages')
    notes = fields.Text(string='Notes')
    permit_no = fields.Char(string='Work Permit No', required=False, readonly=False)
    visa_no = fields.Char(string='Visa No', required=False, readonly=False)
    visa_expire = fields.Date(string='Visa Expire Date')
    state = fields.Selection(selection=[('draft', 'New'), ('open', 'Running'), ('pending', 'To Renew'), ('close', 'Expired')], string='Status', track_visibility='onchange',help='Status of the contract', default='draft')

    @api.onchange('employee_id')
    def onchange_employee_id(self):
        self.job_id = self.employee_id.job_id.id
        self.department_id = self.employee_id.department_id.id

    @api.one
    @api.constrains('date_start', 'date_end')
    def _check_dates(self):
        if self.date_start and self.date_end and self.date_start > self.date_end:
            raise ValidationError('Contract start-date must be less than contract end-date.')

    @api.multi
    def set_as_pending():
        return self.write({'state': 'pending'})

    @api.multi
    def set_as_close():
        return self.write({'state': 'close'})

    @api.multi
    def _track_subtype(self, init_values):
        self.ensure_one()
        if 'state' in init_values and self.state == 'pending':
            return 'hr_contract.mt_contract_pending'
        elif 'state' in init_values and self.state == 'close':
            return 'hr_contract.mt_contract_close'
        return super(HrContract, self)._track_subtype(init_values)
