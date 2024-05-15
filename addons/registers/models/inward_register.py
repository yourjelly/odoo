from odoo import api,models,fields

class InwardRegister(models.Model):
    _name = "inward.register"
    _description = "Inward Register"
    
    # Fields inward registrer contains
    #                                                     || Reply to out||
    #                || inward letter||                   || which letter||                           ||    Reply    ||
    # General Number || No. || Date || From whom recieved || No. || Date || Subject || Date of Reciept || No. || Date || Number of compliment
    general_number = fields.Char('General Number', required=True)
    name = fields.Char('name', compute="_compute_name")
    inward_letter_date = fields.Date('Date', default=fields.Date.context_today, required=True)
    inward_letter_no = fields.Char('No')
    # inward_letter = fields.Char("Inward letter ( No - Date )", compute = "_compute_inward_letter")
    from_whome_recieved = fields.Char('From whome recieved')
    reply_to_out_no = fields.Char('No')
    reply_to_out_date = fields.Date('Date')
    subject = fields.Char('Subject')
    date_of_reciept = fields.Date('Date of reciept')
    reply_no = fields.Char('No')
    reply_date = fields.Date('Reply Date')
    number_of_compliment = fields.Char('Number of Compliment')
    remark = fields.Char("Remark")

    # attachment = fields.Binary("Attachment")
    
    def _compute_name(self):
        for rec in self:
            rec.name = rec.general_number
