# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.mrp.tests.common import TestMrpCommon
from odoo.tests import Form
from odoo.tests.common import SavepointCase


class TestMrpProductionBackorder(TestMrpCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

    def setUp(self):
        super().setUp()
        warehouse_form = Form(self.env['stock.warehouse'])
        warehouse_form.name = 'Test Warehouse'
        warehouse_form.code = 'TWH'
        self.warehouse = warehouse_form.save()

    def test_no_tracking_1(self):
        """Create a MO for 4 product. Produce 4. The backorder button should
        not appear and hitting mark as done should not open the backorder wizard.
        The name of the MO should be MO/001.
        """
        mo = self.generate_mo(qty_final=4)[0]

        mo_form = Form(mo)
        mo_form.qty_producing = 4
        mo = mo_form.save()

        # No backorder is proposed
        self.assertTrue(mo.button_mark_done())
        self.assertEqual(mo._get_quantity_to_backorder(), 0)
        self.assertTrue("-001" not in mo.name)

    def test_no_tracking_2(self):
        """Create a MO for 4 product. Produce 1. The backorder button should
        appear and hitting mark as done should open the backorder wizard. In the backorder
        wizard, choose to do the backorder. A new MO for 3 self.untracked_bom should be
        created.
        The sequence of the first MO should be MO/001-01, the sequence of the second MO
        should be MO/001-02.
        Check that all MO are reachable through the procurement group.
        """
        production, _, _, product_to_use_1, _ = self.generate_mo(qty_final=4, qty_base_1=3)
        self.assertEqual(production.state, 'confirmed')
        self.assertEqual(production.reserve_visible, True)

        # Make some stock and reserve
        for product in production.move_raw_ids.product_id:
            self.env['stock.quant'].with_context(inventory_mode=True).create({
                'product_id': product.id,
                'inventory_quantity': 100,
                'location_id': production.location_src_id.id,
            })
        production.action_assign()
        self.assertEqual(production.state, 'confirmed')
        self.assertEqual(production.reserve_visible, False)

        mo_form = Form(production)
        mo_form.qty_producing = 1
        production = mo_form.save()

        production.button_mark_done()
        backorder = Form(self.env['mrp.production.backorder'].with_context(default_mrp_production_ids=[production.id]))
        backorder.save().action_backorder()

        # Two related MO to the procurement group
        self.assertEqual(len(production.procurement_group_id.mrp_production_ids), 2)

        # Check MO backorder
        mo_backorder = production.procurement_group_id.mrp_production_ids[-1]
        self.assertEqual(mo_backorder.product_id.id, production.product_id.id)
        self.assertEqual(mo_backorder.product_qty, 3)
        self.assertEqual(sum(mo_backorder.move_raw_ids.filtered(lambda m: m.product_id.id == product_to_use_1.id).mapped("product_uom_qty")), 9)
        self.assertEqual(mo_backorder.reserve_visible, False)  # the reservation of the first MO should've been moved here

    def test_no_tracking_pbm_1(self):
        """Create a MO for 4 product. Produce 1. The backorder button should
        appear and hitting mark as done should open the backorder wizard. In the backorder
        wizard, choose to do the backorder. A new MO for 3 self.untracked_bom should be
        created.
        The sequence of the first MO should be MO/001-01, the sequence of the second MO
        should be MO/001-02.
        Check that all MO are reachable through the procurement group.
        """
        with Form(self.warehouse) as warehouse:
            warehouse.manufacture_steps = 'pbm'

        production, _, product_to_build, product_to_use_1, product_to_use_2 = self.generate_mo(qty_base_1=4, qty_final=4, picking_type_id=self.warehouse.manu_type_id)

        move_raw_ids = production.move_raw_ids
        self.assertEqual(len(move_raw_ids), 2)
        self.assertEqual(set(move_raw_ids.mapped("product_id")), {product_to_use_1, product_to_use_2})

        pbm_move = move_raw_ids.move_orig_ids
        self.assertEqual(len(pbm_move), 2)
        self.assertEqual(set(pbm_move.mapped("product_id")), {product_to_use_1, product_to_use_2})
        self.assertFalse(pbm_move.move_orig_ids)

        mo_form = Form(production)
        mo_form.qty_producing = 1
        production = mo_form.save()
        self.assertEqual(sum(pbm_move.filtered(lambda m: m.product_id.id == product_to_use_1.id).mapped("product_qty")), 16)
        self.assertEqual(sum(pbm_move.filtered(lambda m: m.product_id.id == product_to_use_2.id).mapped("product_qty")), 4)

        backorder = Form(self.env['mrp.production.backorder'].with_context(default_mrp_production_ids=[production.id]))
        backorder.save().action_backorder()

        mo_backorder = production.procurement_group_id.mrp_production_ids[-1]
        self.assertEqual(mo_backorder.delivery_count, 1)

        pbm_move |= mo_backorder.move_raw_ids.move_orig_ids
        # Check that quantity is correct
        self.assertEqual(sum(pbm_move.filtered(lambda m: m.product_id.id == product_to_use_1.id).mapped("product_qty")), 16)
        self.assertEqual(sum(pbm_move.filtered(lambda m: m.product_id.id == product_to_use_2.id).mapped("product_qty")), 4)

        self.assertFalse(pbm_move.move_orig_ids)

    def test_no_tracking_pbm_sam_1(self):
        """Create a MO for 4 product. Produce 1. The backorder button should
        appear and hitting mark as done should open the backorder wizard. In the backorder
        wizard, choose to do the backorder. A new MO for 3 self.untracked_bom should be
        created.
        The sequence of the first MO should be MO/001-01, the sequence of the second MO
        should be MO/001-02.
        Check that all MO are reachable through the procurement group.
        """
        with Form(self.warehouse) as warehouse:
            warehouse.manufacture_steps = 'pbm_sam'

        production, _, product_to_build, product_to_use_1, product_to_use_2 = self.generate_mo(qty_base_1=4, qty_final=4, picking_type_id=self.warehouse.manu_type_id)

        move_raw_ids = production.move_raw_ids
        self.assertEqual(len(move_raw_ids), 2)
        self.assertEqual(set(move_raw_ids.mapped("product_id")), {product_to_use_1, product_to_use_2})

        pbm_move = move_raw_ids.move_orig_ids
        self.assertEqual(len(pbm_move), 2)
        self.assertEqual(set(pbm_move.mapped("product_id")), {product_to_use_1, product_to_use_2})
        self.assertFalse(pbm_move.move_orig_ids)
        self.assertEqual(sum(pbm_move.filtered(lambda m: m.product_id.id == product_to_use_1.id).mapped("product_qty")), 16)
        self.assertEqual(sum(pbm_move.filtered(lambda m: m.product_id.id == product_to_use_2.id).mapped("product_qty")), 4)

        sam_move = production.move_finished_ids.move_dest_ids
        self.assertEqual(len(sam_move), 1)
        self.assertEqual(sam_move.product_id.id, product_to_build.id)
        self.assertEqual(sum(sam_move.mapped("product_qty")), 4)

        mo_form = Form(production)
        mo_form.qty_producing = 1
        production = mo_form.save()

        backorder = Form(self.env['mrp.production.backorder'].with_context(default_mrp_production_ids=[production.id]))
        backorder.save().action_backorder()

        mo_backorder = production.procurement_group_id.mrp_production_ids[-1]
        self.assertEqual(mo_backorder.delivery_count, 2)

        pbm_move |= mo_backorder.move_raw_ids.move_orig_ids
        self.assertEqual(sum(pbm_move.filtered(lambda m: m.product_id.id == product_to_use_1.id).mapped("product_qty")), 16)
        self.assertEqual(sum(pbm_move.filtered(lambda m: m.product_id.id == product_to_use_2.id).mapped("product_qty")), 4)

        sam_move |= mo_backorder.move_finished_ids.move_orig_ids
        self.assertEqual(sum(sam_move.mapped("product_qty")), 4)


class TestMrpWorkorderBackorder(SavepointCase):
    @classmethod
    def setUpClass(cls):
        super(TestMrpWorkorderBackorder, cls).setUpClass()
        cls.uom_unit = cls.env['uom.uom'].search([
            ('category_id', '=', cls.env.ref('uom.product_uom_categ_unit').id),
            ('uom_type', '=', 'reference')
        ], limit=1)
        cls.finished1 = cls.env['product.product'].create({
            'name': 'finished1',
            'type': 'product',
        })
        cls.compfinished1 = cls.env['product.product'].create({
            'name': 'compfinished1',
            'type': 'product',
        })
        cls.compfinished2 = cls.env['product.product'].create({
            'name': 'compfinished2',
            'type': 'product',
        })
        cls.workcenter1 = cls.env['mrp.workcenter'].create({
            'name': 'workcenter1',
        })
        cls.workcenter2 = cls.env['mrp.workcenter'].create({
            'name': 'workcenter2',
        })

        cls.bom_finished1 = cls.env['mrp.bom'].create({
            'product_id': cls.finished1.id,
            'product_tmpl_id': cls.finished1.product_tmpl_id.id,
            'product_uom_id': cls.uom_unit.id,
            'product_qty': 1,
            'type': 'normal',
            'bom_line_ids': [
                (0, 0, {'product_id': cls.compfinished1.id, 'product_qty': 1}),
                (0, 0, {'product_id': cls.compfinished2.id, 'product_qty': 1}),
            ],
            'operation_ids': [
                (0, 0, {'sequence': 1, 'name': 'finished operation 1', 'workcenter_id': cls.workcenter1.id}),
                (0, 0, {'sequence': 2, 'name': 'finished operation 2', 'workcenter_id': cls.workcenter2.id}),
            ],
        })
        cls.bom_finished1.bom_line_ids[0].operation_id = cls.bom_finished1.operation_ids[0].id
        cls.bom_finished1.bom_line_ids[1].operation_id = cls.bom_finished1.operation_ids[1].id

    def test_1(self):
        """Operations are set on `self.bom_kit1` but none on `self.bom_finished1`."""
        mo_form = Form(self.env['mrp.production'])
        mo_form.product_id = self.finished1
        mo_form.bom_id = self.bom_finished1
        mo_form.product_qty = 2.0
        mo = mo_form.save()

        mo.action_confirm()
        mo.button_plan()

        self.assertEqual(len(mo.workorder_ids), 2)

        workorder1 = mo.workorder_ids[0]
        workorder2 = mo.workorder_ids[1]

        self.assertEqual(workorder1.raw_workorder_line_ids.product_id, self.compfinished1)
        self.assertEqual(workorder1.raw_workorder_line_ids.qty_to_consume, 2)

        #mrp_production_workorder_form_view_inherit
        workorder1.button_start()
        with Form(workorder1) as w:
            w.qty_producing = 1
        workorder1.record_production()

        self.assertEqual(workorder2.raw_workorder_line_ids.product_id, self.compfinished2)
        self.assertEqual(workorder2.raw_workorder_line_ids.qty_to_consume, 2)

        workorder2.button_start()
        with Form(workorder2) as w:
            w.qty_producing = 1
        workorder2.record_production()

        backorder_wiz = mo.with_context(debug=True).button_mark_done()
        backorder = Form(self.env['mrp.production.backorder'].with_context(default_mrp_production_ids=[mo.id]))
        backorder.save().action_backorder()
        mo_backorder = mo.procurement_group_id.mrp_production_ids[-1]
        mo_backorder.button_plan()
        self.assertEqual(len(mo_backorder.workorder_ids), 2)
        self.assertEqual(mo_backorder.workorder_ids[0].raw_workorder_line_ids.qty_to_consume, 1)

        self.assertEqual(workorder1.state, 'done')
        self.assertEqual(workorder2.state, 'done')
