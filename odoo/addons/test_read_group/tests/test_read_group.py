from odoo.tests.common import TransactionCase, tagged
from odoo import Command


@tagged("read_group_m2o")
class TestM2oCase(TransactionCase):

    def test_m2o_with_display_name(self):
        order = self.env['test_read_group.order'].create([
            {'line_ids': [Command.create({'value': 69})], 'name': 'foo'},
        ])

        # test that _read_group_raw only sends back the id
        res = self.env['test_read_group.order.line']\
            ._read_group_raw([], ['order_id'], ['order_id'])[0][0]['order_id']
        self.assertIsInstance(res, int)
        self.assertEqual(order.id, res)

        # test that read_group sends back (id, name_get)
        res = self.env['test_read_group.order.line']\
            .read_group([], ['order_id'], ['order_id'])[0]['order_id']
        self.assertIsInstance(res, tuple)
        self.assertEqual(order.id, res[0])
        self.assertEqual(order.name, str(res[1]))
