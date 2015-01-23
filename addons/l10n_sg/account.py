from openerp.osv import fields, osv

class account_tax_code(osv.Model):
    
    _inherit = 'account.tax.code'
    _columns = {
        'printable': fields.boolean("Print on Report", help="If checked, this code will be printed on Taxes Report."),
    }
    
    _defaults = {
        'printable': True,
    }