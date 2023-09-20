# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.exceptions import ValidationError

from .diff_utils import apply_patch, generate_comparison, generate_patch


class HtmlFieldHistory(models.AbstractModel):
    _name = "html.field.history.mixin"
    _description = "Field html History"
    _max_html_field_history_revisions = 300

    html_field_history_revisions = fields.Json(
        "History revisions data", prefetch=False
    )

    html_field_history_metadata = fields.Json(
        "History revisions metadata", compute="_compute_metadata", store=True
    )

    @api.model
    def _get_versioned_fields(self):
        """This method should be overriden

        :return: List[string]: A list of name of the fields to be versioned
        """
        return []

    @api.depends("html_field_history_revisions")
    def _compute_metadata(self):
        for history in self:
            if not history.html_field_history_revisions:
                continue

            html_field_history_metadata = {}
            for field_name in history.html_field_history_revisions:
                html_field_history_metadata[field_name] = []
                for revision in history.html_field_history_revisions[
                    field_name
                ]:
                    metadata = revision.copy()
                    metadata.pop("patch")
                    html_field_history_metadata[field_name].append(metadata)
            history.html_field_history_metadata = html_field_history_metadata

    def write(self, vals):
        new_revisions = False
        versioned_fields = self._get_versioned_fields()
        vals_contain_versioned_fields = set(vals).intersection(versioned_fields)
        old_contents = {}

        if vals_contain_versioned_fields:
            self.ensure_one()

            for field_name in versioned_fields:
                # For security reason we have to ensure the versioned field is
                # declared as sanitize=True
                if (
                    field_name in vals
                    and not self.env[self._name]._fields[field_name].sanitize
                ):
                    raise ValidationError(
                        "%s field in model %s is not declared as sanitize=True"
                        % (field_name, self._name)
                    )

                old_contents[field_name] = self[field_name]

        # Call super().write before generating the patch to be sure we perform
        # the diff on sanitized data
        write_result = super().write(vals)

        if not vals_contain_versioned_fields:
            return write_result

        html_field_history_revisions = (
            self.html_field_history_revisions
            if self.html_field_history_revisions
            else {}
        )

        for field_name in versioned_fields:
            new_content = self[field_name]

            if field_name not in html_field_history_revisions:
                html_field_history_revisions[field_name] = []

            if new_content and self.id and isinstance(vals[field_name], str):
                old_content = old_contents[field_name]
                if isinstance(old_content, str) and new_content != old_content:
                    new_revisions = True
                    patch = generate_patch(new_content, old_content)
                    revision_id = (
                        (
                            html_field_history_revisions[field_name][0][
                                "revision_id"
                            ]
                            + 1
                        )
                        if html_field_history_revisions[field_name]
                        else 1
                    )

                    html_field_history_revisions[field_name].insert(
                        0,
                        {
                            "patch": patch,
                            "revision_id": revision_id,
                            "create_date": self.env.cr.now().isoformat(),
                            "create_uid": self.env.uid,
                            "create_user_name": self.env.user.name,
                        },
                    )
                    html_field_history_revisions[
                        field_name
                    ] = html_field_history_revisions[field_name][
                        : self._max_html_field_history_revisions
                    ]
        # Call super().write again to include the new revision
        if new_revisions:
            extra_vals = {
                "html_field_history_revisions": html_field_history_revisions
            }
            write_result = write_result and super().write(extra_vals)
        return write_result

    def html_field_history_get_content_at_revision(
        self, field_name, revision_id
    ):
        """Get the requested field content restored at the revision_id.

        :param str field_name: the name of the field
        :param int revision_id: id of the last revision to restore

        :return: string: the restored content
        """
        self.ensure_one()

        revisions = [
            i
            for i in self.html_field_history_revisions[field_name]
            if i["revision_id"] >= revision_id
        ]

        content = self[field_name]
        for revision in revisions:
            content = apply_patch(content, revision["patch"])

        return content

    def html_field_history_get_comparison_at_revision(
        self, field_name, revision_id
    ):
        """For the requested field,
        Get a comparison between the current content of the field and the
        content restored at the requested revision_id.

        :param str field_name: the name of the field
        :param int revision_id: id of the last revision to compare

        :return: string: the comparison
        """
        self.ensure_one()
        restored_content = self.html_field_history_get_content_at_revision(
            field_name, revision_id
        )

        return generate_comparison(self[field_name], restored_content)
