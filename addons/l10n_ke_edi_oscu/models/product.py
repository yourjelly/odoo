# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
import requests
from collections import defaultdict

from odoo import _, api, Command, fields, models
from odoo.addons.base.models.ir_qweb_fields import Markup
from odoo.exceptions import UserError
from ..utils import check_required_fields

URL = "https://etims-api-sbx.kra.go.ke/etims-api/"
SAVE_ITEM_URL = URL + "saveItem"
FETCH_ITEM_URL = URL + "selectItemList"
SAVE_STOCK_MASTER_URL = URL + "saveStockMaster"
INSERT_STOCK_IO_URL = URL + "insertStockIO"
IMPORT_ITEM_URL = URL + "selectImportItemList"
FETCH_UNSPSC_URL = URL + "selectItemClsList"

_logger = logging.getLogger(__name__)

class ProductTemplate(models.Model):
    _inherit = 'product.template'

    l10n_ke_packaging_unit_id = fields.Many2one(
        'l10n_ke_edi_oscu.code',
        related='product_variant_ids.l10n_ke_packaging_unit_id',
        readonly=False, string='Packaging Unit',
        domain=[('code_type', '=', '17')],
        help='KRA code that describes the type of packaging used.',
    )
    l10n_ke_packaging_quantity = fields.Float(
        string='Package Quantity',
        related='product_variant_ids.l10n_ke_packaging_quantity',
        readonly=False, default=1,
    )
    l10n_ke_quantity_unit_id = fields.Many2one(
        'l10n_ke_edi_oscu.code',
        related='product_variant_ids.l10n_ke_quantity_unit_id',
        readonly=False, string='Packaging Unit',
        domain=[('code_type', '=', '10')],
        help='KRA code that describes the type of packaging used.',
    )
    l10n_ke_origin_country_id = fields.Many2one(
        'res.country',
        related='product_variant_ids.l10n_ke_origin_country_id',
        readonly=False, string='Origin Country',
    )
    l10n_ke_tax_type_code = fields.Char(related='product_variant_ids.l10n_ke_tax_type_code')
    l10n_ke_product_type_code = fields.Selection(
        related='product_variant_ids.l10n_ke_product_type_code',
        readonly=False,
    )
    l10n_ke_is_insurance_applicable = fields.Boolean(
        related='product_variant_ids.l10n_ke_is_insurance_applicable',
        readonly=False,
    )
    l10n_ke_item_code = fields.Char(string="KRA Item Code", related='product_variant_ids.l10n_ke_item_code')

    def action_l10n_ke_oscu_save_item(self):
        if self.product_variant_count != 1:
            raise UserError
        return self.product_variant_ids.action_l10n_ke_oscu_save_item()

    def action_l10n_ke_oscu_save_stock_master(self):
        if self.product_variant_count != 1:
            raise UserError
        return self.product_variant_ids.action_l10n_ke_oscu_save_stock_master()

class ProductProduct(models.Model):
    _inherit = 'product.product'

    l10n_ke_packaging_unit_id = fields.Many2one(
        'l10n_ke_edi_oscu.code',
        string='Packaging Unit',
        domain=[('code_type', '=', '17')],
        compute='_compute_l10n_ke_packaging_unit_id',
        store=True, readonly=False,
        help='KRA code that describes the type of packaging used.',
    )
    l10n_ke_packaging_quantity = fields.Float(
        string='Package Quantity',
        help='Number of packages of the type described with the Packaging Unit per unit quantity on the invoice line.',
        default=1,
    )
    l10n_ke_quantity_unit_id = fields.Many2one(
        'l10n_ke_edi_oscu.code',
        readonly=False,
        string='Quantity Unit',
        domain=[('code_type', '=', '10')],
        help='KRA code that describes the type of unit used.',
    )
    l10n_ke_origin_country_id = fields.Many2one(
        'res.country',
        readonly=False,
        string='Origin Country',
        help='The origin country of the product.'
    )
    l10n_ke_tax_type_code = fields.Char(compute='_compute_l10n_ke_tax_type_code')
    l10n_ke_product_type_code = fields.Selection(
        string="Product Type",
        selection=[('1', 'Raw Material'), ('2', 'Finished Product'), ('3', 'Service')],
        help="Used by the OSCU to determine the type of the product",
    )
    l10n_ke_is_insurance_applicable = fields.Boolean(string='Insurance Applicable')
    l10n_ke_item_code = fields.Char(compute='_compute_l10n_ke_item_code', store=True)

    @api.depends('taxes_id.l10n_ke_tax_type')
    def _compute_l10n_ke_tax_type_code(self):
        for product in self:
            tax_codes = product.taxes_id.mapped("l10n_ke_tax_type")
            product.l10n_ke_tax_type_code = tax_codes[0].code if tax_codes else ''

    @api.depends('detailed_type')
    def _compute_l10n_ke_packaging_unit_id(self):
        """ Assign a value to the packaging unit by default, based on the type of product it is. """
        service_packaging = self.env.ref('l10n_ke_edi_oscu.packaging_type_ou', raise_if_not_found=False)
        for product in self:
            product.l10n_ke_packaging_unit_id = service_packaging if product.detailed_type == 'service' else None

    @api.depends(
        'l10n_ke_origin_country_id.code',
        'l10n_ke_product_type_code',
        'l10n_ke_packaging_unit_id.code',
        'l10n_ke_quantity_unit_id.code',
    )
    def _compute_l10n_ke_item_code(self):
        """ Computes the item code of a given product

        For instance KE1NTXU is an item code, where
        KE:      first two digits are the origin country of the product
        1:       the product type (raw material)
        NT:      the packaging type
        XU:      the quantity type
        0000006: a unique value (id in our case)
        """
        for product in self:
            code_fields = [
                product.l10n_ke_origin_country_id.code,
                product.l10n_ke_product_type_code,
                product.l10n_ke_packaging_unit_id.code,
                product.l10n_ke_quantity_unit_id.code,
            ]
            if not all(code_fields):
                product.l10n_ke_item_code = ''
                continue

            item_code_prefix = ''.join(code_fields)
            product.l10n_ke_item_code = item_code_prefix + \
                ('0'*20)[:-len(item_code_prefix)-len(str(product.id))] + \
                str(product.id)

    def _l10n_ke_oscu_save_item_content(self):
        """ When saving an item to the OSCU, these are the required fields. """
        self.ensure_one()

        content = {
            'itemCd':      self.l10n_ke_item_code,                               # Item Code
            'itemClsCd':   self.unspsc_code_id.code or '',                       # HS Code (unspsc format)
            'itemTyCd':    self.l10n_ke_product_type_code,                       # Generally raw material, finished product, service
            'itemNm':      self.name,                                            # Product name
            # 'itemStdNm': # standard name (not required)
            'orgnNatCd':   self.l10n_ke_origin_country_id.code,                  # Origin nation code
            'pkgUnitCd':   self.l10n_ke_packaging_unit_id.code,                  # Packaging unit code
            'qtyUnitCd':   self.l10n_ke_quantity_unit_id.code,                   # Quantity unit code
            'taxTyCd':     self.l10n_ke_tax_type_code,                           # Tax type code
            'bcd':         self.barcode or None,                                 # Self barcode
            'dftPrc':      self.standard_price,                                  # Standard price
            'isrcAplcbYn': 'Y' if self.l10n_ke_is_insurance_applicable else 'N', # Is insurance applicable
            'useYn':'Y',
            'regrId':      self.env.user.id,
            'regrNm':      self.env.user.name,
            'modrId':      self.env.user.id,
            'modrNm':      self.env.user.name,
        }
        missing_fields = check_required_fields('ItemSaveReq', content)
        return content

    def action_l10n_ke_oscu_fetch_items(self):
        session = self.env.company.l10n_ke_oscu_get_session()
        last_request_date = self.env['ir.config_parameter'].get_param('l10n_ke_edi_oscu.last_fetch_items_request_date', '20180101000000')
        response = session.post(FETCH_ITEM_URL, json={'lastReqDt': last_request_date})
        response_content = response.json()
        print(response_content)

        if response_content['resultCd'] == '001':
            _logger.info("No new items fetched from the OSCU.")
            return
        # if response_content['resultCd'] == '000':
        #     for item in response_content['data']['item']:

    def action_l10n_ke_oscu_save_item(self):

        session = self.env.company.l10n_ke_oscu_get_session()
        for product in self:
            content = product._l10n_ke_oscu_save_item_content()
            response = session.post(SAVE_ITEM_URL, json=content)
            print(response.content)
            if response.ok:
                product.l10n_ke_item_code = content['itemCd']
                self.env.cr.commit()
                raise UserError("Saved!")

    def _l10n_ke_oscu_save_stock_master_content(self):
        """ When initializing a stock quantity for an item, these are the required fields """
        self.ensure_one()
        content = {
            'itemCd':      self.l10n_ke_item_code,                               # Item code
            'rsdQty':      self.qty_available,                                   # Remaining Quantity
            'regrId':      self.env.user.id,
            'regrNm':      self.env.user.name,
            'modrId':      self.env.user.id,
            'modrNm':      self.env.user.name,
        }
        missing_fields = check_required_fields('StockMasterSaveReq', content)
        return content

    def action_l10n_ke_oscu_save_stock_master(self):
        session = self.env.company.l10n_ke_oscu_get_session()
        for product in self:
            content = product._l10n_ke_oscu_save_stock_master_content()
            response = session.post(SAVE_STOCK_MASTER_URL, json=content)
            print(f"\n\n RESPONSE {response.json()}")
                # product.l10n_ke_item_code = content[product]['itemCd']

    @api.model
    def _l10n_ke_oscu_find_product_from_json(self, product_dict):
        """ Find a product matching that of a given product represented json format provided by the API

        :param dict product_dict: dictionary representing the fields of the product as obtained from
                                  the API.
        :returns:                 a tuple, containing a product (or None type) that is strongest
                                  match to an item with the given details, and a message if
                                  describing the method by which the matching that was accomplished.
        """
        search_domain = [('l10n_ke_item_code', '=', product_dict['itemCd']), ('name', '=', product_dict['itemNm'])]
        if (product := self.search(search_domain, limit=1)):
            return product, _('"%s" matched with an exact matching of name and item code.', product.name)

        fuzzy_name = ('name', 'ilike', f"%{'%'.join(product_dict['itemNm'].split())}%")
        search_domain = [('l10n_ke_item_code', '=', product_dict['itemCd']), fuzzy_name]
        if (product := self.search(search_domain, limit=1)):
            return product, _(
                '"%s" matched using an inexact matching of name, and an exact matching of item code.',
                product.name,
            )
        search_domain = [('unspsc_code_id.code', '=', product_dict['itemClsCd']), fuzzy_name]
        if (product := product_dict.get('itemClsCd') and self.search(search_domain, limit=1)):
            return product, _(
                '"%s" matched with an inexact matching of name, and an exact matching of UNSPSC code.',
                product.name,
            )
        search_domain = [
            fuzzy_name,
            ('l10n_ke_packaging_unit_id.code', '=', product_dict['pkgUnitCd']),
            ('l10n_ke_quantity_unit_id.code', '=', product_dict['qtyUnitCd']),
        ]
        if (product := self.search(search_domain, limit=1)):
            return product, _(
                '"%s" matched using an inexact matching of name, and an exact matching of packaging '
                'unit and unit of measure.',
                product.name,
            )
        return None, None

    @api.model
    def _l10n_ke_oscu_create_product_from_json(self, product_dict):
        """ Find a product matching that of a given product represented json format provided by the API

        :param dict product_dict: dictionary representing the fields of the product as obtained from
                                  the API.
        :returns:                 a tuple, containing the product that has been created using the
                                  given details, and a message describing the created product.
        """
        uom_code = self.env['l10n_ke_edi_oscu.code'].search([
            ('code', '=', product_dict['qtyUnitCd']), ('code_type', '=', '10'),
        ], limit=1)
        packaging_code = self.env['l10n_ke_edi_oscu.code'].search([
            ('code', '=', product_dict['pkgUnitCd']), ('code_type', '=', '17'),
        ], limit=1)
        unspsc_code = self.env['product.unspsc.code'].search([('code', '=', product_dict['itemClsCd'])], limit=1)
        import pdb; pdb.set_trace()
        price_ksh = product_dict['dftPrc'] if 'dftPrc' in product_dict else product_dict.get('prc', 0) # TODO currency conversion
        taxes = self.env['account.tax'].search([('l10n_ke_tax_type.code', '=', product_dict['taxTyCd'])], order="sequence")
        taxes_to_use = self.env['account.tax']
        for tax in taxes:
            if not tax.company_id in taxes_to_use.mapped("company_id"):
                taxes_to_use |= tax

        create_vals = {
            'name':                       product_dict['itemNm'],
            'l10n_ke_packaging_quantity': product_dict.get('pkg'),
            'l10n_ke_packaging_unit_id':  packaging_code.id,
            'l10n_ke_quantity_unit_id':   uom_code.id,
            'l10n_ke_product_type_code':  product_dict.get('itemTyCd'),
            'unspsc_code_id':             unspsc_code.id,
            'standard_price':             price_ksh,
            'taxes_id':                   taxes_to_use.ids,
        }
        message_parts = [
            _("Created a product with the details:"),
            _("Name:           %s", product_dict['itemNm']),
            _("Packaging:      %s", packaging_code.name),
            _("UoM:            %s", uom_code.name),
            _("UNSPSC Code:    %s", unspsc_code.code),
        ]

        if product_dict.get('orgnNatCd'):
            origin_country = self.env['res.country'].search([('code', '=', product_dict['orgnNatCd'])], limit=1)
            create_vals['l10n_ke_origin_country_id'] = origin_country.id
            message_parts.append(_("Origin Country: %s", origin_country.name))

        if product_dict.get('bcd'):
            create_vals['barcode'] = product_dict['bcd']
            message_parts.append(_("Barcode: %s", product_dict['bcd']))

        return self.create(create_vals), Markup("<br/>").join(message_parts)

    @api.model
    def _l10n_ke_assign_products_from_json(self, lines_dict):
        """ Using the info from the JSON, update the given item with a product id, if a product
            can't be found then create one.

        :param dict lines_dict: dictionary of the form 'itemSeq': item where item is a JSON
                                dictionary representing the fields of the product as obtained from
                                the API.
        :returns:               lines_dict, with values updated in place.
        """
        # Ordered representation of the relevant fields
        relevant_product_fields = (
            'itemNm', 'itemCd', 'bcd', 'pkg', 'pkgUnitCd', 'qtyUnitCd', 'itemClsCd', 'prc',
            'taxTyCd',
        )
        fields_to_products = {}
        for item_seq, item in lines_dict.items():
            product_fields = tuple(item[field] for field in relevant_product_fields)
            if product_fields in fields_to_products:
                item['product'] = fields_to_products[product_fields]
                continue

            product_dict = {key: val for key, val in zip(relevant_product_fields, product_fields)}
            product, message = self._l10n_ke_oscu_find_product_from_json(product_dict)
            if (product or message):
                fields_to_products[product_fields] = product
                item.update({'product': product, 'messsage': message})
                continue

            product, message = self._l10n_ke_oscu_create_product_from_json(product_dict)
            item['product'] = fields_to_products[product_fields] = product
            item['message'] = message

        return lines_dict


class ProductCode(models.Model):

    _inherit = 'product.unspsc.code'

    def _cron_l10n_ke_oscu_get_codes_from_device(self):
        """ Automatically fetch and create UNSPSC codes from the OSCU if they don't already exist """
        company = self.env['res.company'].search([
            ('l10n_ke_oscu_cmc_key', '!=', False),
        ], limit=1)
        if not company:
            _logger.error('No OSCU initialized company could be found. No KRA Codes fetched.')
            return

        session = company.l10n_ke_oscu_get_session()
        # The API will return all codes added since this date
        last_request_date = self.env['ir.config_parameter'].get_param('l10n_ke_oscu.last_unspsc_code_request_date', '20180101000000')
        response = session.post(FETCH_UNSPSC_URL, json={'lastReqDt': last_request_date})
        print(response.content)
        if (response_content := response.ok and response.json()):
            if response_content['resultCd'] == '001':
                _logger.info("No new UNSPSC codes fetched from the OSCU.")
                return
            if response_content['resultCd'] == '000':
                cls_list = response_content['data']['itemClsList']
                existing_codes = self.search([
                    ('code', 'in', [code_dict['itemClsCd'] for code_dict in cls_list])
                ]).mapped("code")

                new_codes = self.env['product.unspsc.code'].create([{
                    'name': code_dict['itemClsNm'],
                    'code': code_dict['itemClsCd'],
                    'applies_to': 'product',
                } for code_dict in cls_list if code_dict['itemClsCd'] not in existing_codes])

                _logger.info("%i UNSPSC codes fetched from the OSCU, %i UNSPSC codes created", len(cls_list), len(new_codes))
                self.env['ir.config_parameter'].sudo().set_param('l10n_ke_oscu.last_unspsc_code_request_date', fields.Datetime.now().strftime('%Y%m%d%H%M%S'))
                return
            _logger.error('Request Error Code: %s, Message: %s', response_content['resultCd'], response_content['resultMsg'])

# {'tin': 'P052112956W',
#  'itemCd': '00000000000000000016',
#  'itemClsCd': '10101501',
#  'itemTyCd': '2',
#  'itemNm': 'Corner Desk Right Sit',
#  'itemStdNm': None,
#  'orgnNatCd': 'BJ',
#  'pkgUnitCd': 'AM',
#  'qtyUnitCd': '4B',
#  'taxTyCd': 'B',
#  'btchNo': None,
#  'regBhfId': '00',
#  'bcd': None,
#  'dftPrc': 0,
#  'grpPrcL1': 0,
#  'grpPrcL2': 0,
#  'grpPrcL3': 0,
#  'grpPrcL4': 0,
#  'grpPrcL5': 0,
#  'addInfo': None,
#  'sftyQty': 0,
#  'isrcAplcbYn': 'Y',
#  'rraModYn': 'N',
#  'useYn': 'Y'}
