from odoo import api, fields, models

class AnalyticBudget(models.Model):
    _name = 'analytic.budget'
    _inherit = 'analytic.mixin'
    _description = "Analytic Budget"

    name = fields.Char()
    start_date = fields.Date()
    end_date = fields.Date()
    responsible_id = fields.Many2one('res.users')
    company_id = fields.Many2one(
        comodel_name='res.company',
        required=True,
        default=lambda self: self.env.company,
    )
    budget_type = fields.Selection(
        selection=[
            ('revenue', 'Revenue'),
            ('expense', 'Expense'),
        ],
        required=True,
    )
    state = fields.Selection(
        selection=[
            ('draft', 'Draft'),
            ('confirmed', 'Confirmed'),
            ('done', 'Done'),
            ('revised', 'Revised'),
            ('canceled', 'Canceled')
        ],
        required=True,
        default='draft',
    )
