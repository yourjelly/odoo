from odoo import api,models,fields
from datetime import date
class OutwardRegister(models.Model):
    _name = "outward.register"
    _description = "Outward Register"
    
    # Fields Outward registrer contains
    # Date | Serial No | Full Name | Address | Place | Description | Stamp Recieved | Stamp Affixed | Balance  | Remark  

    name = fields.Char(compute="_compute_name")
    serial_no = fields.Char('Serial Number', required=True)
    date = fields.Date('Date',default=fields.Date.context_today, required=True)
    month = fields.Char('month', compute="_compute_month", store=True)
    full_name = fields.Char('Full Name', required=True)
    address = fields.Char('Address')
    place = fields.Char('Place')
    description = fields.Char('Description')
    stamp_received = fields.Char('Stamp Received')
    stamp_affixed = fields.Char('Stamp Affixed')
    balance = fields.Char('Balance')
    remark = fields.Char('Remark')

    @api.depends('date')
    def _compute_month(self):
        for rec in self:
            if rec.date:
                rec.month = rec.date.strftime("%B")

    def _compute_name(self):
        for rec in self:
            rec.name = rec.serial_no