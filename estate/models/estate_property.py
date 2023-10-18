from odoo import models, fields


class EstateProperty(models.Model):
    _name = 'estate_property'
    _description = "This is a real estate property model"

    name = fields.Char(string="Name", required=True)
    description = fields.Text(string="Description")
    postcode = fields.Char(string="Postcode")
    date_availability = fields.Date(string="Date Availability")
    expected_price = fields.Float(string="Expected Price", required=True)
    selling_price = fields.Float(string="selling_price")
    bedrooms = fields.Integer(string="Bedrooms")
    living_area = fields.Integer(string="Living Area")
    facades = fields.Integer(string="Facades")
    garage = fields.Boolean(string="Garage")
    garden = fields.Boolean(string="Garden")
    garden_area = fields.Boolean(string="Garden Area")
    garden_orientation = fields.Selection(
        string="Garden Orientation",
        selection=[('north', 'North'),
                   ('south', 'South'),
                   ('east', 'East'),
                   ('west', 'West')],
    )
