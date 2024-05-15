from odoo import api,models,fields
from odoo.exceptions import UserError, ValidationError

class ExpandableRegister(models.Model):
    _name = "expandable.register"
    _description = "Expandable Register"
    
    # Fields expandable registrer contains

    name =fields.Char("Sr. No.", required=True)
    referance_no = fields.Char("Referancec No. of incomming Items of CSR")
    date_of_receipt = fields.Date("Date of Receipt", default=fields.Date.context_today )
    opening_balance = fields.Char("Opening Balance")
    received_quantity = fields.Float("Recieved Quanitity")
    total_quantity = fields.Float("Total Quantity", compute="_compute_total_quantity")
    rate = fields.Float("Rate")
    sign_of_storekeeper_1 = fields.Char("Signature of Storekeeper")
    signature_head_1 = fields.Char("Signature of Head of Institute")
    date_of_despatch = fields.Date("Date of Despatch")
    indent_no = fields.Char("Indent No.")
    indent_date = fields.Date("Indent Date")
    in_which_section_given = fields.Char("In Which Section Given", help="In Which Section Given ( with Name of receiving employee )")
    quantity_issued = fields.Float("Quantity Issued")
    sign_of_receiving_employee = fields.Char("Signature of Recieving Employee")
    closing_balance = fields.Float("Closing Balance", compute="_compute_closing_balance")
    sign_of_storekeeper_2 = fields.Char("Signature of Storekeeper")
    sign_of_principal = fields.Char("Signature of Principal")
    remark = fields.Char("remark")

    @api.depends("opening_balance", "received_quantity")
    def _compute_total_quantity(self):
        for rec in self:
            rec.total_quantity = rec.opening_balance + rec.received_quantity

    def _compute_closing_balance(self):
        for rec in self:
            rec.closing_balance = rec.total_quantity - rec.quantity_issued
            if rec.closing_balance < 0:
                raise ValidationError("There is not enough quantity available.")
        