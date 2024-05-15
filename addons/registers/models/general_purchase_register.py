from odoo import api,models,fields

class GeneralPurchaseRegister(models.Model):
    _name = "general_purchase.register"
    _description = "General Purchase Register"
    
    # Fields general purchase register registrer contains
    # Sr. No. || Recieve Date || Purchase Order No. || Name of Business Firm || Address || Details of Recieved Material
    # Recieved Quantity || Rate || Total Cost || Bill No || Name of Ragister where Material Noted || Serial No. of Register Where Material Noted 
    # Sign of Store Keeper || SIgn of Head of Institute || Type of Payment || Remarks
    name =fields.Char('Sr. No.', required=True)
    recieve_date = fields.Date('Recieved Date', default=fields.Date.context_today, required=True)
    purchase_order_no = fields.Char('Purchase Order No.')
    name_of_business_firm = fields.Char('Name Of Business FIrm')
    address = fields.Char('Address')
    details_of_recieved_material = fields.Many2one('material.details', 'Details of Recieved Material')
    recieved_qty = fields.Float('Recieved Quantity', default="0")
    rate = fields.Float('Rate', default="0")
    total_cost = fields.Float('Total Cost', compute="_compute_total_cost", store=True)
    bill_no = fields.Char('Bill No.')
    name_of_register_where_material_noted = fields.Char('Name of register where material noted')
    serial_no_of_register_where_material_noted = fields.Char('Serial No. of Register Where Material Noted')
    type_of_payment = fields.Char('Type Of Payment')
    sign_of_store_keeper = fields.Char("Sign of Store Keeper")
    sign_of_head_of_institute = fields.Char("Sign of HOD")
    remark = fields.Char("Remark")
    
    @api.depends('rate', 'recieved_qty')
    def _compute_total_cost(self):
        for rec in self:
            rec.total_cost = rec.recieved_qty*rec.rate

    @api.model
    def default_get(self, fields):
        defaults = super().default_get(fields)
        active_id = self._context.get("active_id")
        if active_id:
            voucher_id = self.env['voucher.register'].browse(int(active_id))
            defaults['name_of_business_firm'] = voucher_id.name_of_firm
            defaults['recieve_date'] = voucher_id.date
        return defaults

    def _compute_name(self):
        for rec in self:
            rec.name = rec.general_number

    @api.model_create_multi
    def create(self, vals_list):
        rec = super().create(vals_list)

        last_record = self.env['consumable.register'].search([('material_id','=',rec.details_of_recieved_material.id)], order="create_date desc", limit=1)
        self.env['consumable.register'].create({
            'reference_of_gpr': rec.id,
            'date_of_receipt':rec.recieve_date,
            'material_id': rec.details_of_recieved_material.id,
            'qty_received': rec.recieved_qty,
            'rate':rec.rate,
            'opening_balance': last_record.closing_balance if last_record else 0
        })
        return rec
