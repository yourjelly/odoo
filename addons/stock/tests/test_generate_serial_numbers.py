# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.exceptions import UserError, ValidationError
from odoo.tests.common import Form, SavepointCase


class StockGenerate(SavepointCase):
    @classmethod
    def setUpClass(cls):
        super(StockGenerate, cls).setUpClass()
        Product = cls.env['product.product']
        cls.product_serial = Product.create({
            'name': 'Tracked by SN',
            'type': 'product',
            'tracking': 'serial',
        })
        cls.uom_unit = cls.env.ref('uom.product_uom_unit')

        cls.warehouse = cls.env['stock.warehouse'].create({
            'name': 'Base Warehouse',
            'reception_steps': 'one_step',
            'delivery_steps': 'ship_only',
            'code': 'BWH'
        })
        cls.supplier_location = cls.env.ref('stock.stock_location_suppliers')
        cls.location = cls.env['stock.location'].create({
            'name': 'Room A',
            'location_id': cls.warehouse.lot_stock_id.id,
        })
        cls.location_dest = cls.env['stock.location'].create({
            'name': 'Room B',
            'location_id': cls.warehouse.lot_stock_id.id,
        })

        cls.Wizard = cls.env['stock.assign.serial']

    def get_new_move(self, nbre_of_lines):
        move = self.env['stock.move'].create({
            'name': 'Move Test',
            'product_id': self.product_serial.id,
            'product_uom': self.uom_unit.id,
            'location_id': self.supplier_location.id,
            'location_dest_id': self.location_dest.id,
            'product_uom_qty': nbre_of_lines,
            'picking_type_id': self.env.ref('stock.picking_type_in').id,
        })
        move._action_confirm()
        move._action_assign()
        return move

    def test_generate_01_sn(self):
        """ Creates a move with 5 move lines, then asks for generates 5 Serial
        Numbers. Checks move has 5  move lines with each a SN.
        """
        nbre_of_lines = 5
        move = self.get_new_move(nbre_of_lines)

        form_wizard = Form(self.env['stock.assign.serial'].with_context(
            default_move_id=move.id,
            default_next_serial_number='001',
            default_next_serial_count=nbre_of_lines,
        ))
        wiz = form_wizard.save()
        self.assertEqual(len(move.move_line_ids), nbre_of_lines)
        wiz.generate_serial_numbers()
        # Checks new move lines have the right SN
        generated_numbers = ['001', '002', '003', '004', '005']
        self.assertEqual(len(move.move_line_ids), len(generated_numbers))
        for move_line in move.move_line_ids:
            # For a product tracked by SN, the `qty_done` is set on 1 when
            # `lot_name` is set.
            self.assertEqual(move_line.qty_done, 1)
            self.assertEqual(move_line.lot_name, generated_numbers.pop(0))

    def test_generate_02_prefix_suffix(self):
        """ Generates some Serial Numbers and checks the prefix and/or suffix
        are correctly used.
        """
        nbre_of_lines = 10
        # Case #1: Prefix, no suffix
        move = self.get_new_move(nbre_of_lines)
        form_wizard = Form(self.env['stock.assign.serial'].with_context(
            default_move_id=move.id,
            default_next_serial_number='bilou-87',
            default_next_serial_count=nbre_of_lines,
        ))
        wiz = form_wizard.save()
        wiz.generate_serial_numbers()
        # Checks all move lines have the right SN
        generated_numbers = [
            'bilou-87', 'bilou-88', 'bilou-89', 'bilou-90', 'bilou-91',
            'bilou-92', 'bilou-93', 'bilou-94', 'bilou-95', 'bilou-96'
        ]
        for move_line in move.move_line_ids:
            # For a product tracked by SN, the `qty_done` is set on 1 when
            # `lot_name` is set.
            self.assertEqual(move_line.qty_done, 1)
            self.assertEqual(
                move_line.lot_name,
                generated_numbers.pop(0)
            )

        move.move_line_ids.unlink()
        move._action_assign()
        # Case #2: No prefix, suffix
        form_wizard = Form(self.env['stock.assign.serial'].with_context(
            default_move_id=move.id,
            default_next_serial_number='005-ccc',
            default_next_serial_count=nbre_of_lines,
        ))
        wiz = form_wizard.save()
        wiz.generate_serial_numbers()
        # Checks all move lines have the right SN
        generated_numbers = [
            '005-ccc', '006-ccc', '007-ccc', '008-ccc', '009-ccc',
            '010-ccc', '011-ccc', '012-ccc', '013-ccc', '014-ccc'
        ]
        for move_line in move.move_line_ids:
            # For a product tracked by SN, the `qty_done` is set on 1 when
            # `lot_name` is set.
            self.assertEqual(move_line.qty_done, 1)
            self.assertEqual(
                move_line.lot_name,
                generated_numbers.pop(0)
            )

        # Case #3: Prefix + suffix
        move.move_line_ids.unlink()
        move._action_assign()
        form_wizard = Form(self.env['stock.assign.serial'].with_context(
            default_move_id=move.id,
            default_next_serial_number='alpha-012-345-beta',
            default_next_serial_count=nbre_of_lines,
        ))
        wiz = form_wizard.save()
        wiz.generate_serial_numbers()
        # Checks all move lines have the right SN
        generated_numbers = [
            'alpha-012-345-beta', 'alpha-012-346-beta', 'alpha-012-347-beta',
            'alpha-012-348-beta', 'alpha-012-349-beta', 'alpha-012-350-beta',
            'alpha-012-351-beta', 'alpha-012-352-beta', 'alpha-012-353-beta',
            'alpha-012-354-beta'
        ]
        for move_line in move.move_line_ids:
            # For a product tracked by SN, the `qty_done` is set on 1 when
            # `lot_name` is set.
            self.assertEqual(move_line.qty_done, 1)
            self.assertEqual(
                move_line.lot_name,
                generated_numbers.pop(0)
            )

    def test_generate_03_raise_exception(self):
        """ Tries to generate some SN but with invalid initial number.
        """
        move = self.get_new_move(3)
        form_wizard = Form(self.env['stock.assign.serial'].with_context(
            default_move_id=move.id,
            default_next_serial_number='code-xxx',
        ))
        wiz = form_wizard.save()
        with self.assertRaises(UserError):
            wiz.generate_serial_numbers()

        form_wizard.next_serial_count = 0
        # Must raise an exception because `next_serial_count` must be greater than 0.
        with self.assertRaises(ValidationError):
            form_wizard.save()

    def test_generate_04_generate_in_multiple_time(self):
        """ Generates a Serial Number for each move lines (except the last one)
        but with multiple assignments, and checks the generated Serial Numbers
        are what we expect.
        """
        nbre_of_lines = 10
        move = self.get_new_move(nbre_of_lines)

        form_wizard = Form(self.env['stock.assign.serial'].with_context(
            default_move_id=move.id,
        ))
        # First assignment
        form_wizard.next_serial_count = 3
        form_wizard.next_serial_number = '001'
        wiz = form_wizard.save()
        wiz.generate_serial_numbers()
        # Second assignment
        form_wizard.next_serial_count = 2
        form_wizard.next_serial_number = 'bilou-64'
        wiz = form_wizard.save()
        wiz.generate_serial_numbers()
        # Third assignment
        form_wizard.next_serial_count = 4
        form_wizard.next_serial_number = 'ro-1337-bot'
        wiz = form_wizard.save()
        wiz.generate_serial_numbers()

        # Checks all move lines have the right SN
        generated_numbers = [
            # Correspond to the first assignment
            '001', '002', '003',
            # Correspond to the second assignment
            'bilou-64', 'bilou-65',
            # Correspond to the third assignment
            'ro-1337-bot', 'ro-1338-bot', 'ro-1339-bot', 'ro-1340-bot',
        ]
        self.assertEqual(len(move.move_line_ids) - 1, len(generated_numbers))
        for idx, move_line in enumerate(move.move_line_ids.sorted(lambda ml: bool(ml.lot_name))):
            if idx == 0:
                self.assertEqual(move_line.qty_done, 0)
                self.assertEqual(move_line.lot_name, False)
            else:
                self.assertEqual(move_line.qty_done, 1)
                self.assertEqual(move_line.lot_name, generated_numbers.pop(0))

    def test_generate_with_putaway(self):
        """ Checks the `location_dest_id` of generated move lines is correclty
        set according to the putaway rules.
        """
        nbre_of_lines = 4
        shelf_location = self.env['stock.location'].create({
            'name': 'shelf1',
            'usage': 'internal',
            'location_id': self.location_dest.id,
        })

        # Checks a first time without putaway...
        move = self.get_new_move(nbre_of_lines)
        form_wizard = Form(self.env['stock.assign.serial'].with_context(
            default_move_id=move.id,
        ))
        form_wizard.next_serial_count = nbre_of_lines
        form_wizard.next_serial_number = '001'
        wiz = form_wizard.save()
        wiz.generate_serial_numbers()

        for move_line in move.move_line_ids:
            self.assertEqual(move_line.qty_done, 1)
            # The location dest must be the default one.
            self.assertEqual(move_line.location_dest_id.id, self.location_dest.id)

        # We need to activate multi-locations to use putaway rules.
        grp_multi_loc = self.env.ref('stock.group_stock_multi_locations')
        self.env.user.write({'groups_id': [(4, grp_multi_loc.id)]})
        # Creates a putaway rule
        self.env['stock.putaway.rule'].create({
            'product_id': self.product_serial.id,
            'location_in_id': self.location_dest.id,
            'location_out_id': shelf_location.id,
        })

        move.move_line_ids.unlink()
        move._action_assign()
        # Checks now with putaway...
        form_wizard = Form(self.env['stock.assign.serial'].with_context(
            default_move_id=move.id,
        ))
        form_wizard.next_serial_count = nbre_of_lines
        form_wizard.next_serial_number = '001'
        wiz = form_wizard.save()
        wiz.generate_serial_numbers()

        for move_line in move.move_line_ids:
            self.assertEqual(move_line.qty_done, 1)
            # The location dest must be now the one from the putaway.
            self.assertEqual(move_line.location_dest_id.id, shelf_location.id)

    def test_set_multiple_lot_name_01(self):
        """ Sets five SN in one time in stock move view form, then checks move
        has five new move lines with the right `lot_name`.
        """
        nbre_of_lines = 10
        move = self.get_new_move(nbre_of_lines)
        # We must begin with a move with 10 move lines.
        self.assertEqual(len(move.move_line_ids), nbre_of_lines)

        value_list = [
            'abc-235',
            'abc-237',
            'abc-238',
            'abc-282',
            'abc-301',
        ]
        values = '\n'.join(value_list)

        picking_form = Form(move.picking_id)
        with picking_form.move_line_ids_without_package.edit(0) as line:
            line.lot_name = values
        move = picking_form.save().move_lines

        # After we set multiple SN, we must have now 15 move lines.
        self.assertEqual(len(move.move_line_ids), nbre_of_lines)
        self.assertEqual({ml.lot_name for ml in move.move_line_ids if ml.lot_name}, set(value_list))
        self.assertEqual(len([ml.lot_name for ml in move.move_line_ids if not ml.lot_name]), 5)

    def test_set_multiple_lot_name_02_empty_values(self):
        """ Sets multiple values with some empty lines in one time, then checks
        we haven't create useless move line and all move line's `lot_name` have
        been correctly set.
        """
        nbre_of_lines = 5
        move = self.get_new_move(nbre_of_lines)
        # We must begin with a move with five move lines.
        self.assertEqual(len(move.move_line_ids), nbre_of_lines)

        value_list = [
            '',
            'abc-235',
            '',
            'abc-237',
            '',
            '',
            'abc-238',
            'abc-282',
            'abc-301',
            '',
        ]
        values = '\n'.join(value_list)

        # Checks we have more values than move lines.
        self.assertTrue(len(move.move_line_ids) < len(value_list))
        picking_form = Form(move.picking_id)
        with picking_form.move_line_ids_without_package.edit(0) as line:
            line.lot_name = values
        move = picking_form.save().move_lines

        filtered_value_list = list(filter(lambda line: len(line), value_list))
        self.assertEqual(len(move.move_line_ids), nbre_of_lines)
        self.assertEqual({ml.lot_name for ml in move.move_line_ids}, set(filtered_value_list))
        self.assertEqual(len([ml.lot_name for ml in move.move_line_ids if not ml.lot_name]), 0)

