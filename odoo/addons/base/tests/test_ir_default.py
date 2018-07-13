# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.exceptions import ValidationError
from odoo.tests.common import TransactionCase


class TestIrDefault(TransactionCase):

    def test_defaults(self):
        """ check the mechanism of user-defined defaults """
        companyA = self.env.user.company_id
        companyB = companyA.create({'name': 'CompanyB'})
        user1 = self.env.user
        user2 = user1.create({'name': 'u2', 'login': 'u2'})
        user3 = user1.create({'name': 'u3', 'login': 'u3',
                              'company_id': companyB.id,
                              'company_ids': companyB.ids})

        # create some default value for some model
        IrDefault1 = self.env['ir.default']
        IrDefault2 = IrDefault1.sudo(user2)
        IrDefault3 = IrDefault1.sudo(user3)

        # set a default value for all users
        IrDefault1.search([('field_id.model', '=', 'res.partner')]).unlink()
        IrDefault1.set('res.partner', 'street', 'GLOBAL', user_id=False, company_id=False)
        self.assertEqual(IrDefault1.get_model_defaults('res.partner'), {'street': 'GLOBAL'},
                         "Can't retrieve the created default value for all users.")
        self.assertEqual(IrDefault2.get_model_defaults('res.partner'), {'street': 'GLOBAL'},
                         "Can't retrieve the created default value for all users.")
        self.assertEqual(IrDefault3.get_model_defaults('res.partner'), {'street': 'GLOBAL'},
                         "Can't retrieve the created default value for all users.")

        # set a default value for current company (behavior of 'set default' from debug mode)
        IrDefault1.set('res.partner', 'street', 'COMPANY', user_id=False, company_id=True)
        self.assertEqual(IrDefault1.get_model_defaults('res.partner'), {'street': 'COMPANY'},
                         "Can't retrieve the created default value for company.")
        self.assertEqual(IrDefault2.get_model_defaults('res.partner'), {'street': 'COMPANY'},
                         "Can't retrieve the created default value for company.")
        self.assertEqual(IrDefault3.get_model_defaults('res.partner'), {'street': 'GLOBAL'},
                         "Unexpected default value for company.")

        # set a default value for current user (behavior of 'set default' from debug mode)
        IrDefault2.set('res.partner', 'street', 'USER', user_id=True, company_id=True)
        self.assertEqual(IrDefault1.get_model_defaults('res.partner'), {'street': 'COMPANY'},
                         "Can't retrieve the created default value for user.")
        self.assertEqual(IrDefault2.get_model_defaults('res.partner'), {'street': 'USER'},
                         "Unexpected default value for user.")
        self.assertEqual(IrDefault3.get_model_defaults('res.partner'), {'street': 'GLOBAL'},
                         "Unexpected default value for company.")

        # check default values on partners
        default1 = IrDefault1.env['res.partner'].default_get(['street']).get('street')
        self.assertEqual(default1, 'COMPANY', "Wrong default value.")
        default2 = IrDefault2.env['res.partner'].default_get(['street']).get('street')
        self.assertEqual(default2, 'USER', "Wrong default value.")
        default3 = IrDefault3.env['res.partner'].default_get(['street']).get('street')
        self.assertEqual(default3, 'GLOBAL', "Wrong default value.")

    def test_conditions(self):
        """ check user-defined defaults with condition """
        IrDefault = self.env['ir.default']

        # default without condition
        IrDefault.search([('field_id.model', '=', 'res.partner')]).unlink()
        IrDefault.set('res.partner', 'street', 'X')
        self.assertEqual(IrDefault.get_model_defaults('res.partner'),
                         {'street': 'X'})
        self.assertEqual(IrDefault.get_model_defaults('res.partner', condition='name=Agrolait'),
                         {})

        # default with a condition
        IrDefault.search([('field_id.model', '=', 'res.country')]).unlink()
        IrDefault.set('res.country', 'code', 'X')
        IrDefault.set('res.country', 'code', 'IN', condition='name=India')
        self.assertEqual(IrDefault.get_model_defaults('res.country'),
                         {'code': 'X'})
        self.assertEqual(IrDefault.get_model_defaults('res.country', condition='name=XYZ'),
                         {})
        self.assertEqual(IrDefault.get_model_defaults('res.country', condition='name=India'),
                         {'code': 'IN'})

    def test_invalid(self):
        """ check error cases with 'ir.default' """
        IrDefault = self.env['ir.default']
        with self.assertRaises(ValidationError):
            IrDefault.set('unknown_model', 'unknown_field', 42)
        with self.assertRaises(ValidationError):
            IrDefault.set('res.partner', 'unknown_field', 42)
        with self.assertRaises(ValidationError):
            IrDefault.set('res.partner', 'lang', 'some_LANG')
        with self.assertRaises(ValidationError):
            IrDefault.set('res.partner', 'company_type', 112)

    def test_removal(self):
        """ check defaults for many2one with their value being removed """
        IrDefault = self.env['ir.default']
        IrDefault.search([('field_id.model', '=', 'res.partner')]).unlink()

        # set a record as a default value
        country = self.env['res.country'].create({'name': 'US'})
        IrDefault.set('res.partner', 'country_id', country.id)
        self.assertEqual(IrDefault.get_model_defaults('res.partner'), {'country_id': country.id})

        # delete the record, and check the presence of the default value
        country.unlink()
        self.assertEqual(IrDefault.get_model_defaults('res.partner'), {})
