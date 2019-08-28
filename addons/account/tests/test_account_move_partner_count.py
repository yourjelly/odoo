# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields
from odoo.tests.common import TransactionCase
import uuid


class TestAccountMovePartnerCount(TransactionCase):

    def setUp(self):
        super().setUp()

        # T1 Create partner and account move
        # (Use a new cursor to make sure creations are committed for later transactions)
        with self.registry.cursor() as cr:
            env = self.env(cr=cr)
            self.partner = self.env['res.partner'].with_env(env).create({'name': 'Lucien'})
            self.journal = self.env['account.journal'].with_env(env).create({
                'name': str(uuid.uuid4()),
                'code': '7775',
                'type': 'sale',
            })
            self.move = self.env['account.move'].with_env(env).create({
                'name': 'Move',
                'partner_id': self.partner.id,
                'type': 'out_invoice',
                'journal_id': self.journal.id,
                'invoice_date': fields.Date.today(),
                'currency_id': self.env.user.company_id.currency_id.id,
            })
            self.move2 = self.env['account.move'].with_env(env).create({
                'name': 'Move2',
                'partner_id': self.partner.id,
                'type': 'out_invoice',
                'journal_id': self.journal.id,
                'invoice_date': fields.Date.today(),
                'currency_id': self.env.user.company_id.currency_id.id,
            })
            self.line = self.env['account.move.line'].with_env(env).create({
                'move_id': self.move.id,
                'name': 'account move line test',
            })
            self.line2 = self.env['account.move.line'].with_env(env).create({
                'move_id': self.move2.id,
                'name': 'account move line test',
            })
            (self.move + self.move2).message_subscribe([self.partner.id])

    def tearDown(self):
        super().tearDown()
        with self.registry.cursor() as cr:
            env = self.env(cr=cr)
            move = self.move.with_env(env)
            move.state = 'draft'
            move.unlink()
            move2 = self.move2.with_env(env)
            move2.state = 'draft'
            move2.unlink()
            self.journal.with_env(env).unlink()
            self.partner.with_env(env).unlink()

    def test_account_move_count(self):
        # T2 create and post account move
        with self.registry.cursor() as cr:
            env = self.env(cr=cr)
            self.move.with_env(env).post()
            partner = self.partner.with_env(env)
            self.assertEqual(partner.supplier_rank, 0)
            self.assertEqual(partner.customer_rank, 1)

    def test_account_move_count_concurrent(self):
        # T2 Lock the partner row
        with self.registry.cursor() as cr:
            env = self.env(cr=cr)
            self.move2.with_env(env).with_context(caca=True).post()

            # T3 concurrently posts account move and tries to update partner
            with self.registry.cursor() as cr:
                env = self.env(cr=cr)
                self.move.with_env(env).with_context(caca=True).post()

                self.assertEqual(self.partner.with_env(env).customer_rank,
                                 0, "It should not wait the concurrent transaction for the update")
