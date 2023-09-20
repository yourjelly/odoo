# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models

from .patch_utils import apply_patch, generate_comparison, generate_patch


class HtmlHistory(models.AbstractModel):
    _name = "field.html.history.mixin"
    _description = "Field html History"

    history_revision_ids = fields.One2many(
        "field.html.history.revision",
        "res_id",
        string="Related revision Ids",
        domain="[('res_model', '=', self._name)]",
    )

    def _get_versioned_field(self):
        """This method should be overriden

        :return: List[string]: A list of name of the fields to be versioned
        """
        return {}

    def write(self, vals):
        versioned_fields = self._get_versioned_field()
        new_revisions_batch = []

        for field_name in versioned_fields:
            new_content = vals[field_name] if field_name in vals else False
            if new_content and self.id and isinstance(vals[field_name], str):
                old_content = getattr(self, field_name)
                if isinstance(old_content, str) and new_content != old_content:
                    patch = generate_patch(new_content, old_content)
                    new_revisions_batch.append(
                        {
                            "res_id": self.id,
                            "res_field": field_name,
                            "res_model": self._name,
                            "patch": patch,
                        }
                    )
        if new_revisions_batch:
            self.env["field.html.history.revision"].sudo().create(
                new_revisions_batch
            )

        return super().write(vals)

    def unlink(self):
        """Delete all revision related to this document"""
        self.env["field.html.history.revision"].search(
            [("res_id", "in", self.ids), ("res_model", "=", self._name)]
        ).unlink()
        return super().unlink()

    def get_field_content_at_revision(self, field_name, revision_id):
        """Get the requested field content restored at the revision_id.

        :param str field_name: the name of the field
        :param int revision_id: id of the last revision to restore

        :return: string: the restored content
        """
        self.ensure_one()
        revisions = self.history_revision_ids.filtered(
            lambda rev: rev.res_field == field_name and rev.id >= revision_id
        )
        revisions = revisions.sorted(key=lambda rev: rev.id, reverse=True)

        content = getattr(self, field_name)
        for revision in revisions:
            content = apply_patch(content, revision.patch)

        return content

    def get_field_comparison_at_revision(self, field_name, revision_id):
        """For the requested field,
        Get a comparison between the current content of the field and the
        content restored at the requested revision_id.

        :param str field_name: the name of the field
        :param int revision_id: id of the last revision to compare

        :return: string: the comparison
        """
        self.ensure_one()
        content = getattr(self, field_name)
        restored_content = self.get_field_content_at_revision(
            field_name, revision_id
        )

        return generate_comparison(
            content, restored_content, ["data-last-history-steps"]
        )
