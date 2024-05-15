from odoo import api,models,fields

class consumableRegister(models.Model):
    _name = "consumable.register"
    _description = "Consumable Register"
    
    # Sr No ||	Reference of Central Store Incomming / Manufactured Item Register || Date of Receipt || Opening Balance ||	
    # Quantity Received	|| Total Quantity || Rate in Rs	|| Sign of store keeper	|| Sign of Head of Institute ||	Despatch Date	
    # Indent No. || Indent Date || In Which Trade this Material is given || Quantity Issued	|| Closing Balance
    # Sign of store keeper	|| Sign of Head of Institute || Remarks || 
    
    # gpr_ids = fields.Many2one("general_purchase.register", "GRP Id", ondelete='cascade')

    name = fields.Char("Sr No.")
    reference_of_gpr = fields.Many2one("general_purchase.register", "Reference of Central Store Incomming / Manufactured Item Register", ondelete='cascade')
    date_of_receipt = fields.Date("Date of Receipt", default=fields.Date.context_today)
    opening_balance = fields.Float("Opening Balance")
    qty_received = fields.Float("Quantity Recieved")
    total_qty = fields.Float("Total Quantity", compute="_compute_total_quantity")
    rate = fields.Float("Rate")
    sign_of_storekeeper_1 = fields.Char("Signature of Storekeeper")
    sign_of_hod_1 = fields.Char("Sign of Head of Institute")
    despatch_date = fields.Date("Despatch Date")
    indent_no = fields.Char("Indent No.")
    indent_date = fields.Date("Indent Date")
    in_which_trade_this_material_given = fields.Char("In Which Trade this Material is given")
    qty_issued = fields.Float("Quantity Issued")
    closing_balance = fields.Float("Closing Balance", compute="_compute_closing_balance")
    sign_of_storekeeper_2 = fields.Char("Signature of Storekeeper")
    sign_of_hod_2 = fields.Char("Sign of Head of Institute")
    remark = fields.Char("remark")

    material_id = fields.Many2one("material.details", "Material Name")


    @api.depends("opening_balance", "qty_received")
    def _compute_total_quantity(self):
        for rec in self:
            rec.total_qty = rec.opening_balance + rec.qty_received

    def _compute_closing_balance(self):
        for rec in self:
            rec.closing_balance = rec.total_qty - rec.qty_issued
            if rec.closing_balance < 0:
                raise ValidationError("There is not enough quantity available.")