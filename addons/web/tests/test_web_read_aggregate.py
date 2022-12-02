from odoo.tests import common


class TestWebReadAggregate(common.TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.Model = cls.env['res.partner']
        # TODO
