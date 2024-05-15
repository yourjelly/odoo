from odoo import api,models,fields

class voucherRegister(models.Model):
    _name = "voucher.register"
    _description = "Voucher Register"
    
    name = fields.Char(compute="_compute_name")
    voucher_no = fields.Char("Voucher No.")
    date = fields.Date("Date", default=fields.Date.context_today)
    account_name = fields.Many2one('account.property', "Account Name")
    name_of_firm = fields.Char("Name of Firm")
    details = fields.Char("Details")
    debit = fields.Float("Debit")
    credit = fields.Float("Credit")
    opening_balance = fields.Float("opening_balance", compute="_compute_opening_balance", store=True)

    def update_opening_balance(self):
        balance = 0
        for rec in self.env['voucher.register'].search([]):
            rec.write({'opening_balance':balance})
            balance = balance + rec.credit - rec.debit

    def _compute_name(self):
        for rec in self:
            rec.name = rec.voucher_no

    def write(self, vals):
        res = super().write(vals)
        return res

    def open_rojmel(self):
        print("working")

    @api.depends("credit", "debit")
    def _compute_opening_balance(self):
        self.opening_balance = 0
        balance = 0
        for rec in self.env['voucher.register'].search([], order="date asc, create_date"):
            rec.write({'opening_balance':balance})
            balance = balance + int(rec.credit) - int(rec.debit)
        

