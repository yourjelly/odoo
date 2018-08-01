from odoo import models, api, fields, _

class Supplier(models.Model):
    _name = 'lunch.supplier'

    ## Basic information
    name = fields.Char(string='Supplier Name', required=True)
    address = fields.Char(string='Address')
    email_address = fields.Char(string='Email Address')
    phone_number = fields.Char(string='Phone Number')
    description = fields.Text(string='Description')
    product_ids = fields.One2many(comodel_name='lunch.product', inverse_name='supplier_id', string='Products')
    location_ids = fields.Many2many(comodel_name='res.partner', string='Sells to these locations', domain=[('is_work_location', '=', True)])

    ## Relational fields

    ## Other information for computed fields
    # recurrence = fields.Selection(selection=[('Specific Day', 'Specific Day'), ('Every Workday', 'Every Workday')], string='Recurrence')
    # date_from = fields.Date(string='Date From')
    # date_to = fields.Date(string='Date To')
    # time_from = fields.Datetime(string='From')
    # time_to = fields.Datetime(string='To')
    # order_method = fields.Selection(selection=[('by phone', 'By Phone'), ('by email', 'By Email')], string='Order Method')
    # is_automatic_send_order = fields.Boolean(string='Send Orders automatically')
    # time_to_send_order = fields.Datetime(string='Time to send order')

    ## Computed fields
    # is_available = fields.Boolean(string='Is available', compute='_compute_is_available')  # this is a computed property depending on the configuration set by the admin

    ###################
    # COMPUTE METHODS #
    ###################

    # @api.depends('recurrence', 'date_from', 'date_to', 'time_from', 'time_to')
    # def _compute_is_available(self):
    #     pass