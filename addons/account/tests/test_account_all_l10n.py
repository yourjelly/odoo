# -*- coding: utf-8 -*-
import logging

import odoo
from odoo import api, fields
from odoo.tests.common import SingleTransactionCase
from odoo.tests import tagged, Form
from unittest.mock import patch, Mock


_logger = logging.getLogger(__name__)


@tagged('-standard', '-at_install', 'post_install', 'l10nall')
class TestAllL10n(SingleTransactionCase):
    """ This test will install all the l10n_* modules.
    As the module install is not yet fully transactional, the modules will
    remain installed after the test.
    """

    @classmethod
    def setUpClass(cls):
        super(TestAllL10n, cls).setUpClass()

        # the installation of l10n_* modules below instanciates a NEW registry, so we
        # have to restore the old one in order to perform the cleanups
        @cls.addClassCleanup
        def cleanup():
            cls.registry.registries[cls.registry.db_name] = cls.registry

        l10n_mods = cls.env['ir.module.module'].search([
            ('name', 'like', 'l10n%'),
            ('state', '=', 'uninstalled'),
        ])
        _logger.info("Modules to install: %s" % [x.name for x in l10n_mods])
        l10n_mods.button_immediate_install()
        # Now that new modules are installed, we have to reset the environment
        api.Environment.reset()
        cls.env = api.Environment(cls.cr, odoo.SUPERUSER_ID, {})

    def l10n_create_invoice(self, move_type):
        product_form = Form(self.env['product.product'])
        product_form.name = 'Test Product'
        product_form.default_code = 'EXP_TP'
        product = product_form.save()

        move_form = Form(self.env['account.move'].with_context(default_move_type=move_type))
        move_form.name = 'BEL 0001-00000001'
        move_form.invoice_date = fields.Date.today()
        move_form.partner_id = self.partner
        with move_form.invoice_line_ids.new() as line_form:
            line_form.product_id = product
        return move_form.save()

    def _validate_invoice_l10n_co_edi(self, invoice):
        return_value = {
            'message': 'mocked success',
            'transactionId': 'mocked_success',
        }
        with patch('odoo.addons.l10n_co_edi.models.carvajal_request.CarvajalRequest.upload', new=Mock(return_value=return_value)):
            invoice.post()


    def l10n_common_coa_test(self, coa_module):
        if coa_module == 'l10n_cl':
            journals_ids = self.env['account.journal'].search([('company_id', '=', self.company.id), ('l10n_latam_use_documents', '=', True)])
            journals = journals_ids.filtered(lambda l: l.l10n_latam_country_code == 'CL' and not l.l10n_cl_sequence_ids)
            for journal in journals:
                journal.button_create_new_sequences()
        in_invoice = self.l10n_create_invoice('in_invoice')
        # I check that Initially vendor bill state is "Draft"
        self.assertEqual(in_invoice.state, 'draft')

        l10n_mods = self.env['ir.module.module'].search([('name', '=', 'l10n_co_edi'), ('state', '=', 'installed')])
        if l10n_mods:
            self._validate_invoice_l10n_co_edi(in_invoice)
        else:
            in_invoice.post()
        # I check that vendor bill state is "Open"
        self.assertEqual(in_invoice.state, 'posted')
        if coa_module != 'l10n_ar':
            out_invoice = self.l10n_create_invoice('out_invoice')
            # I check that Initially customer invoice state is "Draft"
            self.assertEqual(out_invoice.state, 'draft')
            if l10n_mods:
                self._validate_invoice_l10n_co_edi(out_invoice)
            else:
                out_invoice.post()
            # I check that customer invoice state is "Open"
            self.assertEqual(out_invoice.state, 'posted')

    def _createCompany(self, coa, country_id, coa_module):
        vals = {
            'name': 'company_%s' % str(coa.id),
            'country_id': country_id,
            'currency_id': coa.currency_id.id,
        }
        other_vals_get_function = getattr(self, '%s_extra_val_company'%(coa_module),None)
        if other_vals_get_function:
            other_vals_get_function(vals)

        self.company = self.env['res.company'].create(vals)

    def _createPartner(self, country_id, coa_module):
        vals = {
            'name': 'Partner_A',
            'country_id': country_id,
        }
        other_vals_get_function = getattr(self, '%s_extra_val_partner'%(coa_module),None)
        if other_vals_get_function:
            other_vals_get_function(vals)
        self.partner = self.env['res.partner'].create(vals)

    def test_all_l10n(self):
        coas = self.env['account.chart.template'].search([])
        for coa in coas:
            coa_module = self.env['ir.model.data'].search([('res_id','=',coa.id),('model','=','account.chart.template')], limit=1).module
            country_code = coa_module.replace('l10n_','')[:2].upper()
            if coa_module == 'l10n_syscohada':
                country_code = 'BJ'
            company_country_id = self.env['res.country'].search([('code','=',country_code)],limit=1)
            self._createCompany(coa=coa, country_id=company_country_id.id, coa_module=coa_module)
            self._createPartner(country_id=company_country_id.id, coa_module=coa_module)
            self.env.user.company_ids += self.company
            self.env.user.company_id = self.company
            msg = 'Testing COA: %s (company: %s)' % (coa.name, self.company.name)
            _logger.info(msg)
            with self.subTest(msg=msg):
                with self.cr.savepoint():
                    coa.try_loading()
                    self.l10n_common_coa_test(coa_module)
