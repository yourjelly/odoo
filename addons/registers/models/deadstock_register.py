from odoo import api,models,fields

class DeadstockRegister(models.Model):
    _name = "deadstock.register"
    _description = "Deadstock Register"
    
    # Fields deadstock registrer contains
    name =fields.Char('serial Number', required=True)
    description_of_item = fields.Char('Description of Item')
    detail_of_purchase = fields.Char("Details of Purchase", help="Offer Giving Order for Purchase & Details of Purchase")
    details = fields.Float("No. of quantity")
    price = fields.Float("Price")
    sign_of_storekeeper_1 = fields.Char("Signature of Storekeeper")
    sign_of_HOD = fields.Char("Signature of Head Office")
    date_of_issue = fields.Date("Date of Issue")
    indent_no = fields.Char("Indent No.")
    indent_date = fields.Date("Indent Date")
    in_which_section_given = fields.Char("In Which Section Given")
    quantity_issued = fields.Char("Quantity Issued")
    sign_of_receiving_employee = fields.Char("Signature of Recieving Employee")
    closing_balance = fields.Char("Closing Balance")
    sign_of_storekeeper_2 = fields.Char("Signature of Storekeeper")
    sign_of_principal_2 = fields.Char("Signature of Principal")
    remark = fields.Char("remark")