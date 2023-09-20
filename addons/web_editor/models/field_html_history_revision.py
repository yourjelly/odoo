# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class HtmlHistoryRevision(models.Model):
    _name = "field.html.history.revision"
    _description = "Field html History Revision"

    res_field = fields.Char(
        "Related Document Model Field Name", index=True, readonly=True
    )
    res_model = fields.Char(
        "Related Document Model Name", index=True, readonly=True
    )

    res_id = fields.Many2oneReference(
        "Related Document ID",
        index=True,
        readonly=True,
        model_field="res_model",
    )

    patch = fields.Text(string="Diff", readonly=True)

    def get_content(self):
        return (
            self.env[self.res_model]
            .browse([self.res_id])
            .get_field_content_at_revision(self.res_field, self.id)
        )

    def get_comparison(self):
        return (
            self.env[self.res_model]
            .browse([self.res_id])
            .get_field_comparison_at_revision(self.res_field, self.id)
        )
