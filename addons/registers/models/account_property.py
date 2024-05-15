from odoo import api,models,fields

class AccoutnProperty(models.Model):
    _name = "account.property"
    _description = "Account Property"
    
    name = fields.Char("name")
