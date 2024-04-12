import jwt
import json
from datetime import datetime

from odoo import api, Command, models, _

MOVE_TYPE_MAPPING = {
    'INV': 'in_invoice',
    'CRN': 'in_refund',
    'DBN': 'in_invoice'
}

class ProductTemplate(models.Model):
    _inherit = "product.template"

    def _l10n_in_get_notification_action(self, params):
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': params,
        }

    @api.model
    def l10n_in_get_bill_from_qr_raw(self, barcode):
        book_data = requests.get(f'https://www.googleapis.com/books/v1/volumes?q=isbn:{barcode}')
        if book_data.status_code == 200:
            book_data = book_data.json()
            if book_data.get('totalItems'):
                book_data = book_data.get('items')[0].get('volumeInfo')
                return {
                    'name': book_data.get('title'),
                    'description': book_data.get('description'),
                    'image_1920': book_data.get('imageLinks', {}).get('thumbnail'),
                }
        if not book_data.get('totalItems'):
            message = _("Scanned ISBN is not found!")
            return self._l10n_in_get_notification_action({'type': 'danger', 'message': message})
        bill_action = self.env.ref('stock.product_template_action_product').read()[0]
        bill_action.update({
            'views': [[False, "form"]],
            'context': {
                'create': False, # If new button is clicked then below default values will be set again.
                'default_name': book_data.get('title'),
                'default_description': book_data.get('description'),
                'default_image_1920': book_data.get('imageLinks', {}).get('thumbnail'),
                'default_barcode': barcode,
                'default_is_point_of_sale': True,
            }
        })
        return bill_action

    