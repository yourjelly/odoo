# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import date, datetime, timedelta

from odoo.exceptions import ValidationError
from odoo.tests.common import Form, TransactionCase


class TestInventory(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super(TestInventory, cls).setUpClass()
        cls.stock_location = cls.env.ref('stock.stock_location_stock')
        cls.pack_location = cls.env.ref('stock.location_pack_zone')
        cls.pack_location.active = True
        cls.customer_location = cls.env.ref('stock.stock_location_customers')
        cls.uom_unit = cls.env.ref('uom.product_uom_unit')
        cls.product1 = cls.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
            'categ_id': cls.env.ref('product.product_category_all').id,
        })
        cls.product2 = cls.env['product.product'].create({
            'name': 'Product A',
            'type': 'product',
            'tracking': 'serial',
            'categ_id': cls.env.ref('product.product_category_all').id,
        })

    def test_inventory_1(self):
        """ Check that making an inventory adjustment to remove all products from stock is working
        as expected.
        """
        # make some stock
        self.env['stock.quant']._update_available_quantity(self.product1, self.stock_location, 100)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location)), 1.0)
        self.assertEqual(self.env['stock.quant']._get_available_quantity(self.product1, self.stock_location), 100.0)

        # remove them with an inventory adjustment
        inventory_quant = self.env['stock.quant'].search([
            ('location_id', '=', self.stock_location.id),
            ('product_id', '=', self.product1.id),
        ])

        self.assertEqual(len(inventory_quant), 1)
        self.assertEqual(inventory_quant.quantity, 100)
        self.assertEqual(inventory_quant.inventory_quantity, 0)

        inventory_quant.action_apply_inventory()

        # check
        self.assertEqual(self.env['stock.quant']._get_available_quantity(self.product1, self.stock_location), 0.0)
        self.assertEqual(sum(self.env['stock.quant']._gather(self.product1, self.stock_location).mapped('quantity')), 0.0)

    def test_inventory_2(self):
        """ Check that adding a tracked product through an inventory adjustment work as expected.
        """
        inventory_quant = self.env['stock.quant'].search([
            ('location_id', '=', self.stock_location.id),
            ('product_id', '=', self.product2.id)
        ])

        self.assertEqual(len(inventory_quant), 0)

        lot1 = self.env['stock.production.lot'].create({
            'name': 'sn2',
            'product_id': self.product2.id,
            'company_id': self.env.company.id,
        })
        inventory_quant = self.env['stock.quant'].create({
            'location_id': self.stock_location.id,
            'product_id': self.product2.id,
            'lot_id': lot1.id,
            'inventory_quantity': 1
        })

        self.assertEqual(inventory_quant.quantity, 0)
        self.assertEqual(inventory_quant.inventory_diff_quantity, 1)

        inventory_quant.action_apply_inventory()

        # check
        self.assertEqual(self.env['stock.quant']._get_available_quantity(self.product2, self.stock_location, lot_id=lot1), 1.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product2, self.stock_location, lot_id=lot1)), 1.0)
        self.assertEqual(lot1.product_qty, 1.0)

    def test_inventory_3(self):
        """ Check that it's not posisble to have multiple products with a serial number through an
        inventory adjustment
        """
        inventory_quant = self.env['stock.quant'].search([
            ('location_id', '=', self.stock_location.id),
            ('product_id', '=', self.product2.id)
        ])
        self.assertEqual(len(inventory_quant), 0)

        lot1 = self.env['stock.production.lot'].create({
            'name': 'sn2',
            'product_id': self.product2.id,
            'company_id': self.env.company.id,
        })
        inventory_quant = self.env['stock.quant'].create({
            'location_id': self.stock_location.id,
            'product_id': self.product2.id,
            'lot_id': lot1.id,
            'inventory_quantity': 2
        })

        self.assertEqual(len(inventory_quant), 1)
        self.assertEqual(inventory_quant.quantity, 0)

        with self.assertRaises(ValidationError):
            inventory_quant.action_apply_inventory()

    def test_inventory_4(self):
        """ Check that even if a product is tracked by serial number, it's possible to add
        untracked one in an inventory adjustment.
        """
        quant_domain = [
            ('location_id', '=', self.stock_location.id),
            ('product_id', '=', self.product2.id)
        ]
        inventory_quants = self.env['stock.quant'].search(quant_domain)
        self.assertEqual(len(inventory_quants), 0)
        lot1 = self.env['stock.production.lot'].create({
            'name': 'sn2',
            'product_id': self.product2.id,
            'company_id': self.env.company.id,
        })
        self.env['stock.quant'].create({
            'location_id': self.stock_location.id,
            'product_id': self.product2.id,
            'lot_id': lot1.id,
            'inventory_quantity': 1
        })

        inventory_quants = self.env['stock.quant'].search(quant_domain)
        self.assertEqual(len(inventory_quants), 1)
        self.assertEqual(inventory_quants.quantity, 0)

        self.env['stock.quant'].create({
            'location_id': self.stock_location.id,
            'product_id': self.product2.id,
            'inventory_quantity': 10
        })
        inventory_quants = self.env['stock.quant'].search(quant_domain)
        self.assertEqual(len(inventory_quants), 2)
        stock_confirmation_action = inventory_quants.action_apply_inventory()
        stock_confirmation_wizard_form = Form(
            self.env['stock.track.confirmation'].with_context(
                **stock_confirmation_action['context'])
        )

        stock_confirmation_wizard = stock_confirmation_wizard_form.save()
        stock_confirmation_wizard.action_confirm()

        # check
        self.assertEqual(self.env['stock.quant']._get_available_quantity(self.product2, self.stock_location, lot_id=lot1, strict=True), 1.0)
        self.assertEqual(self.env['stock.quant']._get_available_quantity(self.product2, self.stock_location, strict=True), 10.0)
        self.assertEqual(self.env['stock.quant']._get_available_quantity(self.product2, self.stock_location), 11.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product2, self.stock_location, lot_id=lot1, strict=True)), 1.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product2, self.stock_location, strict=True)), 1.0)
        self.assertEqual(len(self.env['stock.quant']._gather(self.product2, self.stock_location)), 2.0)

    def test_inventory_5(self):
        """ Check that assigning an owner does work.
        """
        owner1 = self.env['res.partner'].create({'name': 'test_inventory_5'})

        inventory_quant = self.env['stock.quant'].create({
            'location_id': self.stock_location.id,
            'product_id': self.product1.id,
            'inventory_quantity': 5,
            'owner_id': owner1.id,
        })

        self.assertEqual(inventory_quant.quantity, 0)
        inventory_quant.action_apply_inventory()

        quant = self.env['stock.quant']._gather(self.product1, self.stock_location)
        self.assertEqual(len(quant), 1)
        self.assertEqual(quant.quantity, 5)
        self.assertEqual(quant.owner_id.id, owner1.id)

    def test_inventory_6(self):
        """ Test that for chained moves, making an inventory adjustment to reduce a quantity that
        has been reserved correctly free the reservation. After that, add products in stock and check
        that they're used if the user encodes more than what's available through the chain
        """
        # add 10 products in stock
        inventory_quant = self.env['stock.quant'].create({
            'location_id': self.stock_location.id,
            'product_id': self.product1.id,
            'inventory_quantity': 10,
        })
        inventory_quant.action_apply_inventory()
        self.assertEqual(self.env['stock.quant']._get_available_quantity(self.product1, self.stock_location), 10.0)

        # Make a chain of two moves, validate the first and check that 10 products are reserved
        # in the second one.
        move_stock_pack = self.env['stock.move'].create({
            'name': 'test_link_2_1',
            'location_id': self.stock_location.id,
            'location_dest_id': self.pack_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 10.0,
        })
        move_pack_cust = self.env['stock.move'].create({
            'name': 'test_link_2_2',
            'location_id': self.pack_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 10.0,
        })
        move_stock_pack.write({'move_dest_ids': [(4, move_pack_cust.id, 0)]})
        move_pack_cust.write({'move_orig_ids': [(4, move_stock_pack.id, 0)]})
        (move_stock_pack + move_pack_cust)._action_confirm()
        move_stock_pack._action_assign()
        self.assertEqual(move_stock_pack.state, 'assigned')
        move_stock_pack.move_line_ids.qty_done = 10
        move_stock_pack._action_done()
        self.assertEqual(move_stock_pack.state, 'done')
        self.assertEqual(move_pack_cust.state, 'assigned')
        self.assertEqual(self.env['stock.quant']._gather(self.product1, self.pack_location).quantity, 10.0)
        self.assertEqual(self.env['stock.quant']._get_available_quantity(self.product1, self.pack_location), 0.0)

        # Make and inventory adjustment and remove two products from the pack location. This should
        # free the reservation of the second move.
        inventory_quant = self.env['stock.quant'].search([
            ('location_id', '=', self.pack_location.id),
            ('product_id', '=', self.product1.id)
        ])
        inventory_quant.inventory_quantity = 8
        inventory_quant.action_apply_inventory()
        self.assertEqual(self.env['stock.quant']._gather(self.product1, self.pack_location).quantity, 8.0)
        self.assertEqual(self.env['stock.quant']._get_available_quantity(self.product1, self.pack_location), 0)
        self.assertEqual(move_pack_cust.state, 'partially_available')
        self.assertEqual(move_pack_cust.reserved_availability, 8)

        # If the user tries to assign again, only 8 products are available and thus the reservation
        # state should not change.
        move_pack_cust._action_assign()
        self.assertEqual(move_pack_cust.state, 'partially_available')
        self.assertEqual(move_pack_cust.reserved_availability, 8)

        # Make a new inventory adjustment and bring two now products.
        inventory_quant = self.env['stock.quant'].search([
            ('location_id', '=', self.pack_location.id),
            ('product_id', '=', self.product1.id)
        ])
        inventory_quant.inventory_quantity = 10
        inventory_quant.action_apply_inventory()

        self.assertEqual(self.env['stock.quant']._get_available_quantity(self.product1, self.pack_location), 2)

        # Nothing should have changed for our pack move
        self.assertEqual(move_pack_cust.state, 'partially_available')
        self.assertEqual(move_pack_cust.reserved_availability, 8)

        # Running _action_assign will now find the new available quantity. Indeed, as the products
        # are not discernabl (not lot/pack/owner), even if the new available quantity is not directly
        # brought by the chain, the system fill take them into account.
        move_pack_cust._action_assign()
        self.assertEqual(move_pack_cust.state, 'assigned')

        # move all the things
        move_pack_cust.move_line_ids.qty_done = 10
        move_stock_pack._action_done()

        self.assertEqual(self.env['stock.quant']._get_available_quantity(self.product1, self.pack_location), 0)

    def test_inventory_7(self):
        """ Check that duplicated quants create a single inventory line.
        """
        owner1 = self.env['res.partner'].create({'name': 'test_inventory_7'})
        vals = {
            'product_id': self.product1.id,
            'product_uom_id': self.uom_unit.id,
            'owner_id': owner1.id,
            'location_id': self.stock_location.id,
            'quantity': 1,
        }
        self.env['stock.quant'].create(vals)
        self.env['stock.quant'].create(dict(**vals, inventory_quantity=1))
        self.assertEqual(len(self.env['stock.quant']._gather(self.product1, self.stock_location)), 2.0)
        self.assertEqual(self.env['stock.quant']._get_available_quantity(self.product1, self.stock_location), 2.0)
        self.env['stock.quant']._quant_tasks()
        inventory_quant = self.env['stock.quant'].search([
            ('location_id', '=', self.stock_location.id),
            ('product_id', '=', self.product1.id)
        ])
        self.assertEqual(len(inventory_quant), 1)
        self.assertEqual(inventory_quant.inventory_quantity, 1)
        self.assertEqual(inventory_quant.quantity, 2)

    def test_inventory_counted_quantity(self):
        """ Checks that inventory quants have a `inventory quantity` set on zero
        after an adjustement.
        """
        # Set product quantity to 42.
        inventory_quant = self.env['stock.quant'].create(vals={
            'product_id': self.product1.id,
            'location_id': self.stock_location.id,
            'inventory_quantity': 42,
        })
        # Generate new inventory, its line must have a theoretical
        # quantity to 42 and a counted quantity to 0.
        inventory_quant.action_apply_inventory()
        self.assertEqual(len(inventory_quant), 1)
        self.assertEqual(inventory_quant.inventory_quantity, 0)
        self.assertEqual(inventory_quant.quantity, 42)

    def test_inventory_outdate_1(self):
        """ Checks that inventory adjustment line is marked as outdated after
        its corresponding quant is modify and its value was correctly updated
        after user refreshed it.
        """
        # Set initial quantity to 7
        self.env['stock.quant']._update_available_quantity(self.product1, self.stock_location, 7)
        inventory_quant = self.env['stock.quant'].search([
            ('location_id', '=', self.stock_location.id),
            ('product_id', '=', self.product1.id)
        ])
        # When a quant is created, it must not be marked as outdated
        # and its `inventory_quantity` must be equals to zero.
        self.assertEqual(inventory_quant.inventory_quantity, 0)

        inventory_quant.inventory_quantity = 5
        self.assertEqual(inventory_quant.inventory_diff_quantity, -2)

        # Deliver 3 units
        move_out = self.env['stock.move'].create({
            'name': 'Outgoing move of 3 units',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 3.0,
        })
        move_out._action_confirm()
        move_out._action_assign()
        move_out.move_line_ids.qty_done = 3
        move_out._action_done()

        # Ensure that diff didn't move.
        self.assertEqual(inventory_quant.inventory_diff_quantity, -2)
        self.assertEqual(inventory_quant.inventory_quantity, 5)
        self.assertEqual(inventory_quant.quantity, 4)

        conflict_wizard_values = inventory_quant.action_apply_inventory()
        conflict_wizard_form = Form(self.env['stock.inventory.conflict'].with_context(conflict_wizard_values['context']))
        conflict_wizard = conflict_wizard_form.save()
        conflict_wizard.quant_to_fix_ids.inventory_quantity = 5
        conflict_wizard.action_validate()
        self.assertEqual(inventory_quant.inventory_diff_quantity, 0)
        self.assertEqual(inventory_quant.inventory_quantity, 0)
        self.assertEqual(inventory_quant.quantity, 5)

    def test_inventory_outdate_2(self):
        """ Checks that inventory adjustment line is marked as outdated when a
        quant is manually updated and its value is correctly updated when action
        to refresh is called.
        """
        # Set initial quantity to 7
        vals = {
            'product_id': self.product1.id,
            'product_uom_id': self.uom_unit.id,
            'location_id': self.stock_location.id,
            'quantity': 7,
            'inventory_quantity': 7
        }
        quant = self.env['stock.quant'].create(vals)

        # Decreases quant to 3 and expects inventory line is now outdated
        move_out = self.env['stock.move'].create({
            'name': 'Outgoing move of 3 units',
            'location_id': self.stock_location.id,
            'location_dest_id': self.customer_location.id,
            'product_id': self.product1.id,
            'product_uom': self.uom_unit.id,
            'product_uom_qty': 4.0,
        })
        move_out._action_confirm()
        move_out._action_assign()
        move_out.move_line_ids.qty_done = 4
        move_out._action_done()

        self.assertEqual(quant.inventory_quantity, 7)
        self.assertEqual(quant.inventory_diff_quantity, 0)
        # Refreshes inventory line and expects quantity was recomputed to 3
        quant.inventory_quantity = 3
        self.assertEqual(quant.inventory_quantity, 3)
        self.assertEqual(quant.inventory_diff_quantity, 0)

    def test_inventory_outdate_3(self):
        """  Checks that outdated inventory adjustment line without difference
        doesn't change quant when validated.
        """
        # Set initial quantity to 10
        vals = {
            'product_id': self.product1.id,
            'product_uom_id': self.uom_unit.id,
            'location_id': self.stock_location.id,
            'quantity': 10,
        }
        quant = self.env['stock.quant'].create(vals)

        quant.inventory_quantity = 10
        quant.action_apply_inventory()
        self.assertEqual(quant.quantity, 10)
        self.assertEqual(quant.inventory_quantity, 0)

    def test_inventory_dont_outdate_1(self):
        """ Checks that inventory adjustment line isn't marked as outdated when
        a not corresponding quant is created.
        """
        # Set initial quantity to 7 and create inventory adjustment for product1
        inventory_quant = self.env['stock.quant'].create({
            'product_id': self.product1.id,
            'product_uom_id': self.uom_unit.id,
            'location_id': self.stock_location.id,
            'quantity': 7,
            'inventory_quantity': 5
        })

        # Create quant for product3
        product3 = self.env['product.product'].create({
            'name': 'Product C',
            'type': 'product',
            'categ_id': self.env.ref('product.product_category_all').id,
        })
        self.env['stock.quant'].create({
            'product_id': product3.id,
            'product_uom_id': self.uom_unit.id,
            'location_id': self.stock_location.id,
            'inventory_quantity': 22,
            'reserved_quantity': 0,
        })
        inventory_quant.action_apply_inventory()
        # Expect action apply do not return a wizard
        self.assertEqual(inventory_quant.quantity, 5)

    def test_cyclic_inventory(self):
        """ Check that a location with a cyclic inventory set has its inventory
        properly auto-generate and correctly record relevant dates.
        """
        grp_multi_loc = self.env.ref('stock.group_stock_multi_locations')
        self.env.user.write({'groups_id': [(4, grp_multi_loc.id)]})
        now = datetime.now()
        today = now.date()

        new_loc = self.env['stock.location'].create({
            'name': 'New Cyclic Inv Location',
            'usage': 'internal',
            'location_id': self.stock_location.id,
        })

        existing_loc2 = self.env['stock.location'].create({
            'name': 'Pre-existing Cyclic Inv Location',
            'usage': 'internal',
            'location_id': self.stock_location.id,
            'last_inventory_date': now - timedelta(days=5),
        })

        new_loc_form = Form(new_loc)
        new_loc_form.cyclic_inventory_frequency = 2
        new_loc = new_loc_form.save()

        # check next_inventory_date is correctly calculated
        existing_loc2_form = Form(existing_loc2)
        existing_loc2_form.cyclic_inventory_frequency = 2
        existing_loc2 = existing_loc2_form.save()

        # next_inventory_date = today + cyclic_inventory_frequency
        self.assertEqual(new_loc.next_inventory_date, today + timedelta(days=2))
        # previous inventory done + cyclic_inventory_frequency < today => next_inventory_date = tomorrow
        self.assertEqual(existing_loc2.next_inventory_date, today + timedelta(days=1))
        # check that cyclic inventories are correctly autogenerated
        self.env['stock.quant']._update_available_quantity(self.product1, new_loc, 5)
        self.env['stock.quant']._update_available_quantity(self.product1, existing_loc2, 5)
        # only new_loc should have triggered an inventory
        quant_new_loc = self.env['stock.quant'].search([('location_id', '=', new_loc.id)])
        quant_existing_loc = self.env['stock.quant'].search([('location_id', '=', existing_loc2.id)])
        self.assertEqual(quant_new_loc.inventory_date, new_loc.next_inventory_date)
        self.assertEqual(quant_existing_loc.inventory_date, existing_loc2.next_inventory_date)

        quant_new_loc.inventory_quantity = 10
        (quant_new_loc | quant_existing_loc).action_apply_inventory()
        self.assertEqual(new_loc.last_inventory_date.date(), date.today())
        self.assertEqual(
            existing_loc2.last_inventory_date.date(), date.today())
        self.assertEqual(new_loc.next_inventory_date, date.today() + timedelta(days=2))
        self.assertEqual(existing_loc2.next_inventory_date,
                         date.today() + timedelta(days=2))

    # def test_neg_qty_conflict_inventory(self):
    #     """ Check that auto-created negative quantity stock inventories work correctly."""

    #     Inventory = self.env['stock.inventory']
    #     # check that neg qty will generate inventory
    #     self.env['stock.quant']._update_available_quantity(self.product1, self.stock_location, -1)
    #     Inventory._run_conflict_inventory_tasks()
    #     neg_qty_inventories = Inventory.search([('is_conflict_inventory', '=', True)])
    #     self.assertEqual(len(neg_qty_inventories), 1)
    #     self.assertEqual(neg_qty_inventories.product_ids[0], self.product1)

    #     # check that inventory auto-updates correctly when still in draft
    #     self.env['stock.quant']._update_available_quantity(self.product2, self.stock_location, -1)
    #     self.env['stock.quant']._update_available_quantity(self.product2, self.pack_location, -1)
    #     Inventory._run_conflict_inventory_tasks()
    #     self.assertEqual(len(neg_qty_inventories.product_ids), 2, "New negative quantity product should be auto-added to existing draft inventory")
    #     self.env['stock.quant']._update_available_quantity(self.product2, self.pack_location, 1)
    #     Inventory._run_conflict_inventory_tasks()
    #     self.assertEqual(len(neg_qty_inventories.product_ids), 2, "Only remove 1 of 2 neg quants shouldn't remove product from inventory")
    #     self.env['stock.quant']._update_available_quantity(self.product2, self.stock_location, 1)
    #     Inventory._run_conflict_inventory_tasks()
    #     self.assertEqual(len(neg_qty_inventories.product_ids), 1, "Previously neg quantity product should be auto-removed from existing draft inventory")

    #     # check that inventory does not auto-update/auto-generate when neg qty inventory is in progress
    #     neg_qty_inventories.action_start()
    #     self.env['stock.quant']._update_available_quantity(self.product2, self.stock_location, -1)
    #     Inventory._run_conflict_inventory_tasks()
    #     neg_qty_inventories = Inventory.search([('is_conflict_inventory', '=', True)])
    #     self.assertEqual(len(neg_qty_inventories), 1)
    #     self.assertEqual(len(neg_qty_inventories.product_ids), 1)

    #     # check that inventory auto-deletes when no more neg qtys
    #     neg_qty_inventories.action_cancel_draft()
    #     self.env['stock.quant']._update_available_quantity(self.product1, self.stock_location, 1)
    #     self.env['stock.quant']._update_available_quantity(self.product2, self.stock_location, 1)
    #     Inventory._run_conflict_inventory_tasks()
    #     neg_qty_inventories = Inventory.search([('is_conflict_inventory', '=', True)])
    #     self.assertEqual(len(neg_qty_inventories), 0)

    # def test_dupe_sn_conflict_inventory(self):
    #     """ Check that auto-created duplicated serial number inventories work correctly.
    #     """
    #     lot1 = self.env['stock.production.lot'].create({
    #         'name': 'dupe_sn1',
    #         'product_id': self.product2.id,
    #         'company_id': self.env.company.id,
    #     })
    #     lot2 = lot1.copy(default={'name': 'dupe_sn2'})

    #     Inventory = self.env['stock.inventory']
    #     # check that duplicted SN will auto-generate inventory
    #     self.env['stock.quant']._update_available_quantity(self.product2, self.stock_location, 1, lot_id=lot1)
    #     self.env['stock.quant']._update_available_quantity(self.product2, self.pack_location, 1, lot_id=lot1)
    #     Inventory._run_conflict_inventory_tasks()
    #     dupe_sn_inventories = Inventory.search([('is_conflict_inventory', '=', True), ('lot_ids', "!=", False)])
    #     self.assertEqual(len(dupe_sn_inventories), 1)
    #     self.assertEqual(len(dupe_sn_inventories.lot_ids), 1)
    #     self.assertEqual(len(dupe_sn_inventories.product_ids), 1)

    #     # check that inventory auto-updates correctly when still in draft
    #     self.env['stock.quant']._update_available_quantity(self.product2, self.stock_location, 1, lot_id=lot2)
    #     self.env['stock.quant']._update_available_quantity(self.product2, self.pack_location, 1, lot_id=lot2)
    #     Inventory._run_conflict_inventory_tasks()
    #     self.assertEqual(len(dupe_sn_inventories.lot_ids), 2, "New duplicate SN should be auto-added to existing draft inventory")
    #     self.env['stock.quant']._update_available_quantity(self.product2, self.stock_location, -1, lot_id=lot2)
    #     Inventory._run_conflict_inventory_tasks()
    #     self.assertEqual(len(dupe_sn_inventories.lot_ids), 1)
    #     self.assertEqual(len(dupe_sn_inventories.product_ids), 1, "Only removing 1 of 3 duplicated SNs shouldn't remove product from inventory")

    #     # check that inventory does not auto-update/auto-generate when inventory is in progress
    #     dupe_sn_inventories.action_start()
    #     self.env['stock.quant']._update_available_quantity(self.product2, self.stock_location, 1, lot_id=lot2)
    #     Inventory._run_conflict_inventory_tasks()
    #     dupe_sn_inventories = Inventory.search([('is_conflict_inventory', '=', True)])
    #     self.assertEqual(len(dupe_sn_inventories), 1)
    #     self.assertEqual(len(dupe_sn_inventories.lot_ids), 1)

    #     # check that inventory auto-deletes when no more dupe SNs
    #     dupe_sn_inventories.action_cancel_draft()
    #     self.env['stock.quant']._update_available_quantity(self.product2, self.stock_location, -1, lot_id=lot1)
    #     self.env['stock.quant']._update_available_quantity(self.product2, self.stock_location, -1, lot_id=lot2)
    #     Inventory._run_conflict_inventory_tasks()
    #     neg_qty_inventories = Inventory.search([('is_conflict_inventory', '=', True)])
    #     self.assertEqual(len(neg_qty_inventories), 0)

    # def test_inventory_sn_warning(self):
    #     """ Check that warnings pop up when duplicate SNs added.
    #     Two cases covered:
    #     - Check for dupes within the inventory (i.e. inventory adjustment lines)
    #     - Check for dupes not in inventory (i.e. existing quants w/ same SN name)
    #     """
    #     # check duplicated SN within inventory adjustment
    #     lot1 = self.env['stock.production.lot'].create({
    #         'name': 'sn1',
    #         'product_id': self.product2.id,
    #         'company_id': self.env.company.id,
    #     })
    #     self.env['stock.quant']._update_available_quantity(self.product2, self.pack_location, 1, lot_id=lot1)

    #     inventory = self.env['stock.inventory'].create({
    #         'name': 'Serial Onchange Check',
    #         'location_ids': [self.stock_location.id, self.pack_location.id],
    #         'product_ids': [(4, self.product2.id)],
    #     })

    #     inventory.action_start()
    #     self.assertEqual(len(inventory.line_ids), 1)

    #     inventory_line = self.env['stock.inventory.line'].create({
    #         'inventory_id': inventory.id,
    #         'location_id': self.stock_location.id,
    #         'product_id': self.product2.id,
    #         'prod_lot_id': lot1.id,
    #         'product_qty': 1
    #     })
    #     warning = False
    #     warning = inventory_line._onchange_serial_number()
    #     self.assertTrue(warning, 'Multiple lines with same serial number not detected')
    #     self.assertEqual(list(warning.keys())[0], 'warning', 'Warning message was not returned')

    #     # check duplicate SN outside of inventory adjustment
    #     lot2 = self.env['stock.production.lot'].create({
    #         'name': 'sn2',
    #         'product_id': self.product2.id,
    #         'company_id': self.env.company.id,
    #     })
    #     self.env['stock.quant']._update_available_quantity(self.product2, self.customer_location, 1, lot_id=lot2)
    #     inventory_line.write({
    #         'prod_lot_id': lot2.id,
    #     })
    #     warning = False
    #     warning = inventory_line._onchange_serial_number()
    #     self.assertTrue(warning, 'Reuse of existing serial number not detected')
    #     self.assertEqual(list(warning.keys())[0], 'warning', 'Warning message was not returned')
