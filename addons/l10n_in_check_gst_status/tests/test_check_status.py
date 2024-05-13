from odoo import fields
from odoo.tests.common import TransactionCase, tagged
from odoo.exceptions import UserError
from unittest.mock import patch


@tagged('post_install_l10n', 'post_install', '-at_install')
class TestGSTStatusFeature(TransactionCase):
    def setUp(self):
        self.partner1 = self.env["res.partner"].create(
            {"name": "Active GSTN", "vat": "36AAACM4154G1ZO"}
        )
        self.partner2 = self.env["res.partner"].create(
            {"name": "Cancelled GSTN", "vat": "19AABCT1332L2ZD"}
        )
        self.partner3 = self.env["res.partner"].create(
            {"name": "Invalid GSTN", "vat": "19AABCT1332L20D"}
        )
        self.partner4 = self.env["res.partner"].create(
            {"name": "Without GSTN", "vat": ""}
        )
        self.mock_responses = {
            "active": {
                "data": {"sts": "Active"}
            },
            "cancelled": {
                "data": {"sts": "Cancelled"}
            },
            "invalid": {
                "error": [{"code": "SWEB_9035", "message": "Invalid GSTIN / UID"}],
            },
        }

    def check_gstin_status(self, partner, expected_status, mock_response, raises_exception=False, exception_message=None):
        with patch("odoo.addons.l10n_in_check_gst_status.models.res_partner.jsonrpc") as mock_jsonrpc:
            mock_jsonrpc.return_value = mock_response
            if raises_exception:
                with self.assertRaises(UserError) as e:
                    partner.get_verified_status()
                self.assertEqual(exception_message, str(e.exception))
            else:
                partner.get_verified_status()
                self.assertEqual(partner.l10n_in_gstin_verified_status, expected_status)
                self.assertEqual(partner.l10n_in_gstin_verified_date, fields.Date.today())

    def test_gstin_status(self):
        """Test GSTIN status for various cases"""
        self.check_gstin_status(
            self.partner1,
            expected_status="Active",
            mock_response=self.mock_responses["active"]
        )
        self.check_gstin_status(
            self.partner2,
            expected_status="Cancelled",
            mock_response=self.mock_responses["cancelled"]
        )
        self.check_gstin_status(
            self.partner3,
            expected_status=None,
            mock_response=self.mock_responses["invalid"],
            raises_exception=True,
            exception_message="Invalid GSTIN / UID"
        )
        self.check_gstin_status(
            self.partner4,
            expected_status=None,
            mock_response=None,
            raises_exception=True,
            exception_message="Enter GSTIN before checking the status."
        )
