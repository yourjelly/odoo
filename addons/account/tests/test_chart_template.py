from odoo.addons.account.models.chart_template import update_taxes_from_templates
from odoo.tests import tagged
from odoo.tests.common import SavepointCase


@tagged('post_install', '-at_install')
class TestChartTemplate(SavepointCase):

    @classmethod
    def setUpClass(cls):
        """
            Set up a company with the generic chart template, containing two taxes and a fiscal position.
            We need to add xml_ids to the templates because they are loaded from their xml_ids
        """
        super().setUpClass()

        cls.company = cls.env['res.company'].create({
            'name': 'TestCompany1',
            'country_id': cls.env.ref('base.be').id,
            'account_tax_fiscal_country_id': cls.env.ref('base.be').id,
        })

        cls.chart_template = cls.env.ref("l10n_generic_coa.configurable_chart_template", raise_if_not_found=False)
        if not cls.chart_template:
            cls.skipTest("Accounting Tests skipped because the generic chart of accounts was not found")

        cls.fp_template = cls.env['account.fiscal.position.template']._load_records([{
            'xml_id': 'account.test_fiscal_position_template',
            'values': {
                'name': 'Fiscal Position',
                'chart_template_id': cls.chart_template.id,
                'country_id': cls.env.ref('base.be').id,
                'auto_apply': True,
            },
        }])
        cls.tax_template_1 = cls._create_tax_template('account.test_tax_template_1', 'Tax 1', 1, 'tag_name_1')
        cls.tax_template_2 = cls._create_tax_template('account.test_tax_template_2', 'Tax 2', 2, 'tag_name_2')
        cls.fp_tax_template_1 = cls._create_fiscal_position_tax_template('account.test_fp_tax_template_1', cls.tax_template_1, cls.tax_template_2)

        cls.chart_template.try_loading(company=cls.company)
        cls.chart_template_xmlid = cls.chart_template.get_external_id()[cls.chart_template.id]

    @classmethod
    def _create_tax_template(cls, tax_template_xmlid, name, amount, tag_name=None):
        if tag_name:
            tag = cls.env['account.account.tag'].create({
                'name': tag_name,
                'applicability': 'taxes',
                'country_id': cls.company.country_id.id,
            })
        return cls.env['account.tax.template']._load_records([{
            'xml_id': tax_template_xmlid,
            'values': {
                'name': name,
                'amount': amount,
                'type_tax_use': 'none',
                'chart_template_id': cls.chart_template.id,
                'invoice_repartition_line_ids': [
                    (0, 0, {
                        'factor_percent': 100,
                        'repartition_type': 'base',
                        'tag_ids': [(6, 0, tag.ids)] if tag_name else None,
                    }),
                    (0, 0, {
                        'factor_percent': 100,
                        'repartition_type': 'tax',
                    }),
                ],
                'refund_repartition_line_ids': [
                    (0, 0, {
                        'factor_percent': 100,
                        'repartition_type': 'base',
                        'tag_ids': [(6, 0, tag.ids)] if tag_name else None,
                    }),
                    (0, 0, {
                        'factor_percent': 100,
                        'repartition_type': 'tax',
                    }),
                ],
            },
        }])

    @classmethod
    def _create_fiscal_position_tax_template(cls, fp_tax_template_xmlid, tax_template_src, tax_template_dest):
        return cls.env['account.fiscal.position.tax.template']._load_records([{
            'xml_id': fp_tax_template_xmlid,
            'values': {
                'tax_src_id': tax_template_src.id,
                'tax_dest_id': tax_template_dest.id,
                'position_id': cls.fp_template.id,
            },
        }])

    def test_update_taxes_new_template(self):
        """
        Tests that adding a new tax template and a fiscal position tax template
        creates this new tax and fiscal position line when updating
        """
        fiscal_position = self.env['account.fiscal.position'].search([('company_id', '=', self.company.id)])
        tax_template_3 = self._create_tax_template('account.test_tax_3_template', 'Tax 3', 3, 'tag_name_3')
        tax_template_4 = self._create_tax_template('account.test_tax_4_template', 'Tax 4', 4)
        self._create_fiscal_position_tax_template('account.test_fiscal_position_tax_template', tax_template_3, tax_template_4)
        update_taxes_from_templates(self.env.cr, self.chart_template_xmlid)

        taxes = self.env['account.tax'].search([('company_id', '=', self.company.id), ('name', 'in', [tax_template_3.name, tax_template_4.name])])
        self.assertRecordValues(taxes, [
            {'name': 'Tax 3', 'amount': 3},
            {'name': 'Tax 4', 'amount': 4},
        ])
        self.assertEqual(taxes.invoice_repartition_line_ids.tag_ids.name, 'tag_name_3')
        self.assertRecordValues(fiscal_position.tax_ids.tax_src_id, [
            {'name': 'Tax 1'},
            {'name': 'Tax 3'},
        ])
        self.assertRecordValues(fiscal_position.tax_ids.tax_dest_id, [
            {'name': 'Tax 2'},
            {'name': 'Tax 4'},
        ])

    def test_update_taxes_existing_template_update(self):
        """
        When a template is close enough from the corresponding existing tax we want to update
        that tax with the template values.
        """
        self.tax_template_1.invoice_repartition_line_ids.tag_ids.name += " [DUP]"
        update_taxes_from_templates(self.env.cr, self.chart_template_xmlid)

        tax = self.env['account.tax'].search([('company_id', '=', self.company.id), ('name', '=', self.tax_template_1.name)])
        # Check that tax was not recreated
        self.assertEqual(len(tax), 1)
        # Check that tags have been updated
        self.assertEqual(tax.invoice_repartition_line_ids.tag_ids.name, self.tax_template_1.invoice_repartition_line_ids.tag_ids.name)

    def test_update_taxes_existing_template_recreation(self):
        """
        When a template is too different from the corresponding existing tax we want to recreate
        a new taxes from template.
        """
        # We increment the amount so the template gets slightly different from the
        # corresponding tax and triggers recreation
        old_tax_name = self.tax_template_1.name
        old_tax_amount = self.tax_template_1.amount
        self.tax_template_1.name = "Tax 1 modified"
        self.tax_template_1.amount += 1
        update_taxes_from_templates(self.env.cr, self.chart_template_xmlid)
        # Check that old tax has not been changed
        old_tax = self.env['account.tax'].search([('company_id', '=', self.company.id), ('name', '=', old_tax_name)])
        self.assertEqual(len(old_tax), 1)
        self.assertEqual(old_tax.amount, old_tax_amount)
        # Check that new tax has been recreated
        tax = self.env['account.tax'].search([('company_id', '=', self.company.id), ('name', '=', self.tax_template_1.name)])
        self.assertEqual(len(tax), 1)
        self.assertEqual(tax.amount, self.tax_template_1.amount)

    def test_update_taxes_remove_fiscal_position_from_tax(self):
        """
        Tests that when we remove the tax from the fiscal position mapping it is not
        recreated after update of taxes.
        """
        fiscal_position = self.env['account.fiscal.position'].search([('company_id', '=', self.company.id)])
        fiscal_position.tax_ids.unlink()
        update_taxes_from_templates(self.env.cr, self.chart_template_xmlid)
        self.assertEqual(len(fiscal_position.tax_ids), 0)

    def test_update_taxes_conflict_name(self):
        """
        When recreating a tax during update a conflict name can occur since
        we need to respect unique constraint on (name, company_id, type_tax_use, tax_scope).
        To do so, the old tax needs to be prefixed with "[old] ".
        """
        # We increment the amount so the template gets slightly different from the
        # corresponding tax and triggers recreation
        self.tax_template_1.amount += 1
        update_taxes_from_templates(self.env.cr, self.chart_template_xmlid)
        tax_1_old = self.env['account.tax'].search([('company_id', '=', self.company.id), ('name', '=', "[old] " + self.tax_template_1.name)])
        tax_1_new = self.env['account.tax'].search([('company_id', '=', self.company.id), ('name', '=', self.tax_template_1.name)])
        self.assertEqual(len(tax_1_old), 1, "Old tax still exists but with a different name.")
        self.assertEqual(len(tax_1_new), 1, "New tax have been created with the original name.")

    def test_update_taxes_multi_company(self):
        """
        In a multi-company environment all companies should be correctly updated.
        """
        company_2 = self.env['res.company'].create({
            'name': 'TestCompany2',
            'country_id': self.env.ref('base.be').id,
            'account_tax_fiscal_country_id': self.env.ref('base.be').id,
        })
        self.chart_template.try_loading(company=company_2)

        taxes_before = self.env['account.tax'].search([('name', '=', self.tax_template_1.name)])
        self.assertEqual(taxes_before.mapped('amount'), [self.tax_template_1.amount] * len(taxes_before))

        self.tax_template_1.amount += 1
        update_taxes_from_templates(self.env.cr, self.chart_template_xmlid)

        taxes_after = self.env['account.tax'].search([('name', '=', self.tax_template_1.name)])
        self.assertEqual(taxes_after.mapped('amount'), [self.tax_template_1.amount] * len(taxes_after))
