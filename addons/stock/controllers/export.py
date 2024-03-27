from odoo import http
from odoo.addons.web.controllers.export import Export

class InventoryExport(Export):
    @http.route()
    def get_fields(self, model, prefix='', parent_name='',
                   import_compat=True, parent_field_type=None,
                   parent_field=None, exclude=None):
        if import_compat and model == 'stock.quant':
            fields = super().get_fields(model, prefix, parent_name, import_compat, parent_field_type, parent_field, exclude)
            fields = [f for f in fields if f.get('id') != 'id']
            return fields
        return super().get_fields(model, prefix, parent_name, import_compat, parent_field_type, parent_field, exclude)
