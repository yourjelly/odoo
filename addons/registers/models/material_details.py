from odoo import api,models,fields

class MaterialDetails(models.Model):
    _name = "material.details"
    _description = "Material Details"
    
    # Fields Central Store Register registrer contains
    # 
    name = fields.Char("name")
