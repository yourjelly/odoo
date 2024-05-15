from odoo import api,models,fields

class ScrapRegister(models.Model):
    _name = "scrap.register"
    _description = "Scrap Register"
    
    name =fields.Char("Serial no.", required=True)
    date = fields.Date("Date", default=fields.Date.context_today, required=True)
    opening_balance = fields.Float("Opening Balance")
    incoming_quantity = fields.Float("Incoming Quantity")
    from_where_recieved = fields.Char("From Where Received")
    total_quantity = fields.Float("Total Quantity", compute="_compute_total_quantity", store=True)
    signature_of_depositor = fields.Char("Signature of Depositor")
    sign_of_storekeeper_1 = fields.Char("Signature of Storekeeper")
    principal_signature_1 = fields.Char("Principal's Signature")
    indent_no = fields.Char("Indent No.")
    indent_date = fields.Date("Indent Date")
    dispatch_date = fields.Date("Dispatch Date")
    dispatch_quantity = fields.Float("Dispatch quantity")
    to_whom_issued = fields.Char("To Whom Issued or Sold by auction given details.")
    closing_balance = fields.Char("Closing balance", compute="_compute_closing_balance", store=True)
    sign_of_storekeeper_2 = fields.Char("Signature of Storekeeper")
    principal_signature_2 = fields.Char("Principal's Signature")
    
    # If sold by auction
    receipt_no = fields.Char("Receipt No.")
    date_of_credit = fields.Date("Date of Credit of Such Amount")
    remark = fields.Char("remark")


    @api.depends("opening_balance", "incoming_quantity")
    def _compute_total_quantity(self):
        for rec in self:
            rec.total_quantity = rec.opening_balance + rec.incoming_quantity
        
    def _compute_closing_balance(self):
        for rec in self:
            rec.closing_balance = rec.total_quantity - rec.dispatch_quantity

        