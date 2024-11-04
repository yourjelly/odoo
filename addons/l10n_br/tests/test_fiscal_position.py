# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.tests import TransactionCase, tagged


# post_install only to ensure overrides by other modules (e.g. l10n_br_avatax) don't break this
@tagged("post_install", "-at_install", "post_install_l10n")
class TestL10nBRFiscalPosition(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.env.company.account_fiscal_country_id = cls.env.ref("base.br")
        cls.env.company.country_id = cls.env.ref("base.br")
        cls.env.company.state_id = cls.env.ref("base.state_br_pr")

        FiscalPosition = cls.env["account.fiscal.position"]
        cls.fp_internal = FiscalPosition.create(
            {"name": "internal", "l10n_br_fp_type": "internal", "auto_apply": True, "country_id": cls.env.ref("base.br").id}
        )
        cls.fp_ss_nnm = FiscalPosition.create(
            {"name": "ss_nnm", "l10n_br_fp_type": "ss_nnm", "auto_apply": True, "country_id": cls.env.ref("base.br").id}
        )
        cls.fp_interstate = FiscalPosition.create(
            {"name": "interstate", "l10n_br_fp_type": "interstate", "auto_apply": True, "country_id": cls.env.ref("base.br").id}
        )
        cls.fp_custom = FiscalPosition.create({"name": "custom"})

    def test_10_fiscal_position_internal(self):
        customer_same_state = self.env["res.partner"].create(
            {
                "name": "customer_same_state",
                "state_id": self.env.company.state_id.id,
                "country_id": self.env.company.country_id.id,
            }
        )
        self.assertEqual(
            self.env["account.fiscal.position"]._get_fiscal_position(customer_same_state),
            self.fp_internal,
            "Should have selected the internal fiscal position",
        )

    def test_20_fiscal_position_custom(self):
        customer_with_fp = self.env["res.partner"].create(
            {"name": "customer_custom", "property_account_position_id": self.fp_custom.id}
        )
        self.assertEqual(
            self.env["account.fiscal.position"]._get_fiscal_position(customer_with_fp),
            self.fp_custom,
            "Should have selected the custom fiscal position that's set on the customer",
        )

    def test_30_fiscal_position_ss_nnm(self):
        customer_north_northeast_midwest = self.env["res.partner"].create(
            {
                "name": "customer_north_northeast_midwest",
                "state_id": self.env.ref("base.state_br_ac").id,
                "country_id": self.env.ref("base.br").id,
            }
        )
        self.assertEqual(
            self.env["account.fiscal.position"]._get_fiscal_position(customer_north_northeast_midwest),
            self.fp_ss_nnm,
            "Should have selected the South/Southeast selling to North/Northeast/Midwest fiscal position",
        )

    def test_40_fiscal_position_interstate(self):
        customer_interstate = self.env["res.partner"].create(
            {
                "name": "customer_interstate",
                "state_id": self.env.ref("base.state_br_rs").id,
                "country_id": self.env.ref("base.br").id,
            }
        )
        self.assertEqual(
            self.env["account.fiscal.position"]._get_fiscal_position(customer_interstate),
            self.fp_interstate,
            "Should have selected the interstate fiscal position",
        )

    def test_50_fiscal_position_international(self):
        customer_international = self.env["res.partner"].create(
            {
                "name": "customer_international",
                "country_id": self.env.ref("base.us").id,
            }
        )
        self.assertFalse(
            self.env["account.fiscal.position"]._get_fiscal_position(customer_international),
            "No fiscal position should have been selected",
        )
