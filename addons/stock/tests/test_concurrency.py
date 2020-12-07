# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import random
import string
import threading
import time

from psycopg2 import OperationalError

from odoo.service.model import PG_CONCURRENCY_ERRORS_TO_RETRY
from odoo import api, SUPERUSER_ID
from odoo.tests.common import TransactionCase


class StockQuant(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super(StockQuant, cls).setUpClass()

    def test_true_concurrency_1(self):
        ran_ = random.Random('test_concurrent_update_2')
        name_prod = ''.join(ran_.choice(string.ascii_uppercase + string.digits) for _ in range(50))

        def get_cursors(nb):
            return [self.env.registry.cursor() for _ in range(nb)]

        def create_data_testing():
            with api.Environment.manage(), self.env.registry.cursor() as cursor:
                env0 = api.Environment(cursor, SUPERUSER_ID, {})
                # Create data with the env0 and commit
                stock_location_source = env0['stock.location'].create({
                    'name': 'stock_location_des',
                    'usage': 'internal',
                })
                stock_location_dest = env0['stock.location'].create({
                    'name': 'stock_location_des',
                    'usage': 'internal',
                })
                product = env0['product.product'].create({
                    'name': name_prod,
                    'type': 'product',
                })
                env0['stock.quant']._update_available_quantity(product, stock_location_source, 100_000)
                inventory = env0['stock.inventory'].create({
                    'name': 'remove product1',
                    'location_ids': [(4, stock_location_source.id)],
                    'product_ids': [(4, product.id)]
                })
                inventory.action_start()
                env0['stock.inventory.line'].search([('inventory_id', '=', inventory.id)]).product_qty = 8
                env0.cr.commit()
                env0.clear()
                return product, stock_location_source, stock_location_dest, inventory

        def clean_data_testing(product_id, inventory_id, location_source_id, location_dest_id):
            api.Environment.reset()
            with api.Environment.manage(), self.env.registry.cursor() as cursor:
                env = api.Environment(cursor, SUPERUSER_ID, {})
                product = env['product.product'].browse(product_id)
                location_source = env['stock.location'].browse(location_source_id)
                location_dest = env['stock.location'].browse(location_dest_id)
                env['stock.quant'].search([('product_id', '=', product.id)]).unlink()
                env.cr.execute("DELETE FROM stock_move WHERE product_id = %s", (product.id,))
                env.cr.execute("DELETE FROM stock_move_line WHERE product_id = %s", (product.id,))
                env.cr.execute("DELETE FROM stock_inventory_line WHERE inventory_id = %s", (inventory_id,))
                env.cr.execute("DELETE FROM stock_inventory WHERE id = %s", (inventory_id,))
                location_source.unlink()
                location_dest.unlink()
                product.unlink()
                env.cr.commit()

        def concurrent_move(product_id, location_source_id, location_dest_id, qty):
            def todo():
                with api.Environment.manage(), self.env.registry.cursor() as cursor:

                    print(threading.current_thread().name + " : start try")
                    env = api.Environment(cursor, SUPERUSER_ID, {})

                    product = env['product.product'].browse(product_id)
                    location_source = env['stock.location'].browse(location_source_id)
                    location_dest = env['stock.location'].browse(location_dest_id)
                    move = env['stock.move'].create({
                        'name': 'product1_move',
                        'location_id': location_source.id,
                        'location_dest_id': location_dest.id,
                        'product_id': product.id,
                        'product_uom': product.uom_id.id,
                        'product_uom_qty': qty,
                    })
                    print(threading.current_thread().name + " : confirm move")
                    move._action_confirm()

                    print(threading.current_thread().name + " : assign move + set qty")
                    move._action_assign()
                    move.move_line_ids.qty_done = qty

                    print(threading.current_thread().name + " : move done")
                    move._action_done()

                    print(threading.current_thread().name + " : commit")
                    env.cr.commit()

            def try_todo(retry):
                try:
                    if retry <= 0:
                        print(threading.current_thread().name + " : Don't retry anymore")
                    else:
                        api.Environment.reset()
                        todo()
                except OperationalError as e:
                    if e.pgcode not in PG_CONCURRENCY_ERRORS_TO_RETRY:
                        raise
                    wait_time = random.uniform(0.2, 1 ** (5 - retry))
                    print(threading.current_thread().name + f" : Wait {wait_time}")
                    time.sleep(wait_time)
                    try_todo(retry - 1)

            try_todo(10)
            print(threading.current_thread().name + " : Finished Thread")

        def check_result(product_id, location_source_id, location_dest_id):
            with api.Environment.manage(), self.env.registry.cursor() as cursor:
                env = api.Environment(cursor, SUPERUSER_ID, {})
                # product = env['product.product'].browse(product_id)
                location_source = env['stock.location'].browse(location_source_id)
                location_dest = env['stock.location'].browse(location_dest_id)
                # location_dest = env['stock.location'].browse(location_dest_id)
                quants = env['stock.quant'].search([('location_id', '=', location_source.id)])
                moves = env['stock.move'].search([('location_id', '=', location_source.id)])
                self.assertEqual(sum(quants.mapped("reserved_quantity")), sum(moves.mapped("reserved_availability")))

                quants_dest = env['stock.quant'].search([('location_id', '=', location_dest.id)])
                self.assertEqual(sum(quants.mapped("quantity") + quants_dest.mapped("quantity")), 100_000)
                self.assertEqual(sum(quants_dest.mapped("quantity")), sum(moves.mapped("product_uom_qty")))
                self.assertEqual(sum(quants_dest.mapped("reserved_quantity")), 0.0)


        product, stock_location_source, stock_location_dest, inventory = create_data_testing()
        try:

            pool_thread = []
            for i in range(50):  # Max connection pool is 64
                pool_thread.append(threading.Thread(target=concurrent_move, name=f"T {i}", args=(product.id, stock_location_source.id, stock_location_dest.id, 5)))

            for thread in pool_thread:
                thread.start()

            for thread in pool_thread:
                thread.join()
                print("Pass a join")
                if thread.is_alive():
                    print("Timeout expired")

            print("Check result")
            check_result(product.id, stock_location_source.id, stock_location_dest.id)
        finally:
            print("Clean data")
            clean_data_testing(product.id, inventory.id, stock_location_source.id, stock_location_dest.id)
