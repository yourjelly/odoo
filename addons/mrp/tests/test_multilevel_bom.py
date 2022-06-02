# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.mrp.tests.common import TestMrpCommon


class TestBoM(TestMrpCommon):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        mto = cls.env.ref('stock.route_warehouse0_mto')
        mto.write({'active': True})
        cls.routes = cls.env.ref('mrp.route_warehouse0_manufacture') + mto
        cls.location = cls.env.ref('stock.warehouse0').lot_stock_id

    def build_bom_tree(self, tree):
        assert len(tree) == 2
        assert isinstance(tree[0], str)
        assert isinstance(tree[1], list)
        if len(tree[1]) == 0:
            leaf = (self.env['product.product'].create({
                'name': tree[0],
                'type': 'product',
            }), [])
            self.env['stock.quant']._update_available_quantity(leaf[0], self.location, 10)
            return leaf
        else:
            children = [self.build_bom_tree(child) for child in tree[1]]
            return (self.env['product.product'].create({
                'name': tree[0],
                'type': 'product',
                'route_ids': self.routes.ids,
                'bom_ids': [(0, 0, {
                    'product_qty': 1.0,
                    'consumption': 'flexible',
                    'operation_ids': [(0, 0, {
                        'name': 'Gift Wrap Maching',
                        'workcenter_id': self.workcenter_1.id,
                        'time_cycle_manual': 480,
                    })],
                    'type': 'normal',
                    'bom_line_ids': [
                        (0, 0, {'product_id': child[0].id, 'product_qty': 1.0})
                        for child in children
                    ],
                })],
            }), children)

    def production_tree(self, tree):
        children = [self.production_tree(child) for child in tree[1] if len(child[1]) > 0]
        return (self.env['mrp.production'].search([('product_id', '=', tree[0].id)]), children)

    def get_nodes(self, tree):
        children = sum([self.get_nodes(child) for child in tree[1]], tree[0].browse())
        return tree[0] + children if children else tree[0]

    def replenish(self, product, qty=1):
        replenish_wizard = self.env['product.replenish'].create({
            'product_id': product.id,
            'product_tmpl_id': product.product_tmpl_id.id,
            'product_uom_id': self.uom_unit.id,
            'warehouse_id': self.env.ref('stock.warehouse0').id,
            'quantity': qty,
        })
        replenish_wizard.launch_replenishment()

    def verify_scheduling(self, tree):
        assert_count = 0
        for child in tree[1]:
            assert_count += 1
            msg = f'{child[0].product_id.name} not scheduled before {tree[0].product_id.name}'
            self.assertLess(child[0].date_planned_start, tree[0].date_planned_start, msg)
        for child in tree[1]:
            assert_count += self.verify_scheduling(child)
        return assert_count

    def test_01_scheduling(self):
        self.tree = self.build_bom_tree(('Main', [
            ('Sub 1', [
                ('Sub 1.1', [
                    ('Sub 1.1.1', []),
                    ('Sub 1.1.2', []),
                ]),
                ('Sub 1.2', [
                    ('Sub 1.2.1', []),
                    ('Sub 1.2.2', []),
                ]),
            ]),
            ('Sub 2', [
                ('Sub 2.1', [
                    ('Sub 2.1.1', []),
                    ('Sub 2.1.1', []),
                ]),
                ('Sub 2.2', [
                    ('Sub 2.2.1', []),
                    ('Sub 2.2.1', []),
                ]),
            ]),
        ]))
        self.replenish(self.tree[0], qty=1)
        mo_tree = self.production_tree(self.tree)
        self.get_nodes(mo_tree).button_plan()
        self.assertEqual(self.verify_scheduling(mo_tree), 6)
