# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import TransactionCase, tagged
from odoo.exceptions import ValidationError


@tagged("-at_install", "post_install")
class TestModel(TransactionCase):
    def setUp(self):
        self.env["html.field.history.test"].search([]).unlink()
        super().setUp()

    def test_html_field_history_write(self):
        rec1 = self.env["html.field.history.test"].create(
            {
                "versioned_field_1": "mock content",
            }
        )
        self.assertFalse(
            rec1.html_field_history_revisions,
            "Record creation should not generate revisions",
        )
        self.assertFalse(
            rec1.html_field_history_metadata,
            "We should never have metadata without revisions",
        )

        rec1.write(
            {
                "versioned_field_1": "mock content 2",
            }
        )
        self.assertEqual(
            len(rec1.html_field_history_revisions["versioned_field_1"]), 1
        )
        self.assertEqual(
            len(rec1.html_field_history_metadata["versioned_field_1"]), 1
        )
        self.assertFalse(rec1.html_field_history_revisions["versioned_field_2"])
        self.assertFalse(rec1.html_field_history_metadata["versioned_field_2"])

        rec1.write(
            {
                "versioned_field_1": "mock content 3",
            }
        )
        rec1.write(
            {
                "versioned_field_1": "mock content 4",
            }
        )
        self.assertEqual(
            len(rec1.html_field_history_revisions["versioned_field_1"]), 3
        )
        rec1.unlink()

        rec2 = self.env["html.field.history.test"].create(
            {
                "versioned_field_2": "mock content",
            }
        )
        self.assertFalse(
            rec2.html_field_history_revisions,
            "Record creation should not generate revisions",
        )
        self.assertFalse(
            rec2.html_field_history_metadata,
            "We should never have metadata without revisions",
        )

        with self.assertRaises(
            ValidationError,
            msg="We should not be able to versioned a field that is not declared as sanitize=True",
        ):
            rec2.write(
                {
                    "versioned_field_2": "mock content 2",
                }
            )

        rec2.unlink()
