# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields
from odoo.addons import test_inherit


class TestInheritMother(models.Model, test_inherit.TestInheritMother):

    # extend again the selection of the state field: 'e' must precede 'e'
    state = fields.Selection(selection_add=[('e', 'E')])
    field_in_mother_4 = fields.Char()

    def foo(self):
        return self.bar()
