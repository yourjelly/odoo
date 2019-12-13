# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import timedelta

from odoo import exceptions,fields
from odoo.tests import Form
from odoo.addons.mrp.tests.common import TestMrpCommon
from odoo.tools import float_compare, float_round
from odoo.tests.common import tagged


@tagged('mrp_production')
class TestMrpProductionScheduling(TestMrpCommon):
    def _get_mo_parent_and_child(self):
        parent_product = self.env['product.template'].create({
            'name': 'Parent product',
            'route_ids': [
                (4, self.env.ref('mrp.route_warehouse0_manufacture').id, 0),
                (4, self.env.ref('stock.route_warehouse0_mto').id, 0)
            ]
        })
        child_product = self.env['product.template'].create({
            'name': 'Child product',
            'route_ids': [
                (4, self.env.ref('mrp.route_warehouse0_manufacture').id, 0),
                (4, self.env.ref('stock.route_warehouse0_mto').id, 0)
            ]
        })
        child_component = self.env['product.template'].create({
            'name': 'Child product',
        })
        parent_bom = self.env['mrp.bom'].create({
            'product_id': parent_product.product_variant_ids.id,
            'product_tmpl_id': parent_product.id,
            'product_uom_id': self.uom_unit.id,
            'product_qty': 4.0,
            'routing_id': self.routing_2.id,
            'type': 'normal',
        })
        self.env['mrp.bom.line'].create({
            'bom_id': parent_bom.id,
            'product_id': child_product.product_variant_ids.id,
            'product_qty': 2,
        })
        child_bom = self.env['mrp.bom'].create({
            'product_id': child_product.product_variant_ids.id,
            'product_tmpl_id': child_product.id,
            'product_uom_id': self.uom_unit.id,
            'product_qty': 4.0,
            'routing_id': self.routing_2.id,
            'type': 'normal',
        })
        self.env['mrp.bom.line'].create({
            'bom_id': child_bom.id,
            'product_id': child_component.product_variant_ids.id,
            'product_qty': 2,
        })

        mrp_order_form = Form(self.env['mrp.production'])
        mrp_order_form.product_id = parent_product.product_variant_ids
        mrp_order = mrp_order_form.save()
        mrp_order.action_confirm()

        parent_mrp_production = self.env['mrp.production'].search([('product_id', '=', parent_product.product_variant_ids.id)])
        child_mrp_production = self.env['mrp.production'].search([('product_id', '=', child_product.product_variant_ids.id)])

        assert parent_mrp_production
        assert child_mrp_production

        now = fields.Datetime.now()
        parent_mrp_production.date_planned_start = now + timedelta(hours=10)
        parent_mrp_production.date_planned_finished = now + timedelta(hours=11)
        child_mrp_production.date_planned_start = now + timedelta(hours=2)
        child_mrp_production.date_planned_finished = fields.Datetime.now() + timedelta(hours=4)

        return parent_mrp_production, child_mrp_production

    def test_mrp_production_rescheduling_1(self):
        """Change the start date of the parent MO."""
        parent_mrp_production, child_mrp_production = self._get_mo_parent_and_child()

        self.assertEqual(parent_mrp_production.will_be_late, False)
        self.assertEqual(child_mrp_production.will_be_late, False)

        parent_mrp_production.date_planned_start = child_mrp_production.date_planned_finished - timedelta(hours=1)

        self.assertEqual(parent_mrp_production.will_be_late, True)
        self.assertEqual(child_mrp_production.will_be_late, False)

        parent_mrp_production.action_reschedule()

        self.assertEqual(parent_mrp_production.will_be_late, False)
        self.assertEqual(child_mrp_production.will_be_late, False)
        self.assertAlmostEqual(parent_mrp_production.date_planned_start, child_mrp_production.date_planned_finished)

    def test_mrp_production_rescheduling_2(self):
        """Change the end date of the child MO."""
        parent_mrp_production, child_mrp_production = self._get_mo_parent_and_child()

        self.assertEqual(parent_mrp_production.will_be_late, False)
        self.assertEqual(child_mrp_production.will_be_late, False)

        child_mrp_production.date_planned_finished = parent_mrp_production.date_planned_start + timedelta(hours=1)

        self.assertEqual(parent_mrp_production.will_be_late, True)
        self.assertEqual(child_mrp_production.will_be_late, False)

        parent_mrp_production.action_reschedule()

        self.assertEqual(parent_mrp_production.will_be_late, False)
        self.assertEqual(child_mrp_production.will_be_late, False)
        self.assertAlmostEqual(parent_mrp_production.date_planned_start, child_mrp_production.date_planned_finished)
