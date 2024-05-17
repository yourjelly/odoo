from odoo import _, models
from odoo.exceptions import UserError


class ProductTemplateImportCSV(models.TransientModel):

    _inherit = 'base_import.import'

    def execute_import(self, fields, columns, options, dryrun=False):
        breakpoint()
        res = super().execute_import(fields, columns, options, dryrun=dryrun)
        if options.get('product_import'):
            pass