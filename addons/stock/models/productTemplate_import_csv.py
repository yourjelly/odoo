from odoo import _, models
from odoo.exceptions import UserError


class ProductTemplateImportCSV(models.TransientModel):

    _inherit = 'base_import.import'

    def sanity_check(self, template):
        if template.tracking == 'lot':
            if not template.create_lot_from_import and not template.create_onhand_qty_from_import:
                raise UserError(_('Please enter the lot number and quantity'))
            lot_id = self.env['stock.lot'].create({'product_id': template.product_variant_id.id, 'name': template.create_lot_from_import})
        elif template.tracking == 'serial':
            if not template.create_lot_from_import:
                raise UserError(_('Please enter the serial number'))
            if template.create_onhand_qty_from_import != 1.0:
                raise UserError(_('Product with serial number must have quantity 1'))
            lot_id = self.env['stock.lot'].create({'product_id': template.product_variant_id.id, 'name': template.create_lot_from_import})
        elif template.create_lot_from_import and template.tracking not in ('lot', 'serial'):
            raise UserError(_('Set tracking field to lot id/SN'))
        else:
            lot_id = False
        return lot_id

    def execute_import(self, fields, columns, options, dryrun=False):
        res = super().execute_import(fields, columns, options, dryrun=dryrun)
        if options.get('product_import'):
            location = self.env['stock.warehouse'].search([('company_id', '=', self.env.company.id)], limit=1).lot_stock_id.id
            templates = self.env['product.template'].browse(res.get('ids'))
            quants_to_create = []
            for template in templates:
                lot_id = self.sanity_check(template)
                if template.product_variant_id.exists():
                    vals = {
                        'product_id': template.product_variant_id.id,
                        'location_id': location,
                        'inventory_quantity': template.create_onhand_qty_from_import,
                    }
                    if lot_id:
                        vals.update({'lot_id': lot_id.id})
                    quants_to_create.append(vals)
            self.env['stock.quant'].with_context(inventory_mode=True).create(quants_to_create).action_apply_inventory()
        return res
