# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


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

    @api.model
    def search_read(
        self, domain=None, fields=None, offset=0, limit=None, order=None
    ):
        print("=====================================")
        print("=   revision model :: search_read ===")
        print("=====================================")
        print("domain: ", domain)
        print("fields: ", fields)
        print("offset: ", offset)
        print("limit: ", limit)
        print("order: ", order)
        # ensure the user has read rights on the linked record (res_model)
        if self.env[self.res_model].check_access_rights("read"):

            return self.sudo().search_read(
                domain=domain,
                fields=fields,
                offset=offset,
                limit=limit,
                order=order,
            )

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
