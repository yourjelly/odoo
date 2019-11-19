# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import common


class TestPricelist(common.TestPricelistCommon):

    def test_10_discount(self):
        # Make sure the price using a pricelist is the same than without after
        # applying the computation manually

        usb_adapter = self.product_5
        datacard = self.product_6

        sale_pricelist = self.env['product.pricelist'].create({
            'name': 'Sale pricelist',
            'item_ids': [(0, 0, {
                    'compute_price': 'formula',
                    'base': 'list_price',  # based on public price
                    'price_discount': 10,
                    'product_id': usb_adapter.id,
                    'applied_on': '0_product_variant',
                }), (0, 0, {
                    'compute_price': 'formula',
                    'base': 'list_price',  # based on public price
                    'price_surcharge': -0.5,
                    'product_id': datacard.id,
                    'applied_on': '0_product_variant',
                })]
        })

        context = {}

        public_context = dict(context, pricelist_id=self.public_pricelist.id)
        pricelist_context = dict(context, pricelist_id=sale_pricelist.id)

        usb_adapter_without_pricelist = usb_adapter.with_context(public_context)
        usb_adapter_with_pricelist = usb_adapter.with_context(pricelist_context)
        self.assertEqual(usb_adapter_with_pricelist.lst_price, usb_adapter_with_pricelist.lst_price)
        self.assertEqual(usb_adapter_without_pricelist.lst_price, usb_adapter_without_pricelist.price)
        self.assertEqual(usb_adapter_with_pricelist.price, usb_adapter_without_pricelist.price*0.9)
        # VFE TODO ensure pricelist.get_product_price returns the same values as product.price

        datacard_without_pricelist = datacard.with_context(public_context)
        datacard_with_pricelist = datacard.with_context(pricelist_context)
        self.assertEqual(datacard_with_pricelist.price, datacard_without_pricelist.price-0.5)

        # Make sure that changing the unit of measure does not break the unit
        # price (after converting)
        unit_context = dict(context, pricelist_id=sale_pricelist.id, uom_id=self.uom_unit.id)
        dozen_context = dict(context, pricelist_id=sale_pricelist.id, uom_id=self.uom_dozen.id)

        usb_adapter_unit = usb_adapter.with_context(unit_context)
        usb_adapter_dozen = usb_adapter.with_context(dozen_context)
        self.assertAlmostEqual(usb_adapter_unit.price*12, usb_adapter_dozen.price)
        datacard_unit = datacard.with_context(unit_context)
        datacard_dozen = datacard.with_context(dozen_context)
        # price_surcharge applies to product default UoM, here "Units", so surcharge will be multiplied
        self.assertAlmostEqual(datacard_unit.price*12, datacard_dozen.price)

    def test_20_pricelist_uom(self):
        # Verify that the pricelist rules are correctly using the product's default UoM
        # as reference, and return a result according to the target UoM.
        tonne_price = 100

        # make sure 'tonne' resolves down to 1 'kg'.
        self.uom_ton.rounding = 0.001

        # setup product stored in 'tonnes', with a discounted pricelist for qty > 3 tonnes
        spam = self.env['product.product'].create({
            'name': '1 tonne of spam',
            'uom_id': self.uom_ton.id,
            'uom_po_id': self.uom_ton.id,
            'list_price': tonne_price,
            'type': 'consu'
        })

        pricelist = self.public_pricelist

        self.env['product.pricelist.item'].create({
            'pricelist_id': pricelist.id,
            'applied_on': '0_product_variant',
            'compute_price': 'formula',
            'base': 'list_price',  # based on public price
            'min_quantity': 3,  # min = 3 tonnes
            'price_surcharge': -10,  # -10 EUR / tonne
            'product_id': spam.id
        })

        def test_unit_price(qty, uom, expected_unit_price):
            unit_price = pricelist.get_product_price(spam, qty, uom)
            self.assertAlmostEqual(unit_price, expected_unit_price, msg='Computed unit price is wrong')

        # Test prices - they are *per unit*, the quantity is only here to match the pricelist rules!
        test_unit_price(2, self.uom_kgm, tonne_price / 1000.0)
        test_unit_price(2000, self.uom_kgm, tonne_price / 1000.0)
        test_unit_price(3500, self.uom_kgm, (tonne_price - 10) / 1000.0)
        test_unit_price(2, self.uom_ton, tonne_price)
        test_unit_price(3, self.uom_ton, tonne_price - 10)
