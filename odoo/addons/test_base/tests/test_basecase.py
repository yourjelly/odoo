# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common


class TestSingleTransactionCase(common.SingleTransactionCase):
    """
    Check the whole-class transaction behavior of SingleTransactionCase.
    """

    def test_00(self):
        """ Create a test base record. """
        self.env['test.base'].create({'name': 'test_per_class_teardown'})
        test_bases = self.env['test.base'].search([('name', '=', 'test_per_class_teardown')])
        self.assertEqual(1, len(test_bases), "Test base record not found.")

    def test_01(self):
        """ Find the created test base record. """
        test_bases = self.env['test.base'].search([('name', '=', 'test_per_class_teardown')])
        self.assertEqual(1, len(test_bases), "Test base record not found.")

    def test_20a(self):
        """ Create a test base record with a XML ID """
        test_base_id, _ = self.env['test.base'].name_create('Mr Blue')
        self.env['ir.model.data'].create({'name': 'test_base_name_blue',
                                          'module': 'test_base',
                                          'model': 'test.base',
                                          'res_id': test_base_id})

    def test_20b(self):
        """ Resolve xml id with ref() and browse_ref() """
        xid = 'test_base.test_base_name_blue'
        test_base = self.env.ref(xid)
        pid = self.ref(xid)
        self.assertTrue(pid, "ref() should resolve xid to database ID")
        self.assertEqual(pid, test_base.id, "ref() is not consistent with env.ref()")
        test_base2 = self.browse_ref(xid)
        self.assertEqual(test_base, test_base2, "browse_ref() should resolve xid to browse records")


class TestTransactionCase(common.TransactionCase):
    """
    Check the per-method transaction behavior of TransactionCase.
    """

    def test_00(self):
        """ Create a test base record. """
        test_bases = self.env['test.base'].search([('name', '=', 'test_per_class_teardown')])
        self.assertEqual(0, len(test_bases), "Test base record found.")
        self.env['test.base'].create({'name': 'test_per_class_teardown'})
        test_bases = self.env['test.base'].search([('name', '=', 'test_per_class_teardown')])
        self.assertEqual(1, len(test_bases), "Test base record not found.")

    def test_01(self):
        """ Don't find the created test base record. """
        test_bases = self.env['test.base'].search([('name', '=', 'test_per_class_teardown')])
        self.assertEqual(0, len(test_bases), "Test base record found.")

    def test_20a(self):
        """ Create a test base record with a XML ID then resolve xml id with ref() and browse_ref() """
        test_base_id, _ = self.env['test.base'].name_create('Mr Yellow')
        self.env['ir.model.data'].create({'name': 'test_base_name_yellow',
                                          'module': 'test_base',
                                          'model': 'test.base',
                                          'res_id': test_base_id})
        xid = 'test_base.test_base_name_yellow'
        test_base = self.env.ref(xid)
        pid = self.ref(xid)
        self.assertEquals(pid, test_base.id, "ref() should resolve xid to database ID")
        test_base2 = self.browse_ref(xid)
        self.assertEqual(test_base, test_base2, "browse_ref() should resolve xid to browse records")
