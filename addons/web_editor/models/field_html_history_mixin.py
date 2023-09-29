# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

from .patch_utils import apply_patch, generate_comparison, generate_patch


class HtmlHistory(models.AbstractModel):
    _name = "field.html.history.mixin"
    _description = "Field html History"

    def _get_versioned_field(self):
        """This method should be overriden

        :return: List[string]: A list of name of the fields to be versioned
        """
        return {}

    history_revision_ids = fields.One2many(
        "field.html.history.revision",
        "res_id",
        readonly=True,
        string="Related revision Ids",
        domain="[('res_model', '=', self._name)]",
        # search="_search_history_revision_ids",
    )

    def get_history_revision_ids(self, field_name):
        print("=====================================")
        print("= _get_history_revision_ids===")
        print("=====================================")
        print("field_name: ", field_name)

        assert field_name in self._get_versioned_field()

        records = (
            self.env["field.html.history.revision"]
            .sudo()
            .search(
                [
                    ("res_id", "in", self.ids),
                    ("res_model", "=", self._name),
                    ("res_field", "=", field_name),
                ]
            )
        )
        print("records: ", records)
        return records

    # @api.model
    # def _search_history_revision_ids(self, operator, operand):
    #     print("=====================================")
    #     print("= _search_history_revision_ids===")
    #     print("=====================================")
    #     print("operator: ", operator)
    #     print("operand: ", operand)
    #     return [("history_revision_ids", operator, operand)]
    #
    # def read(self, fields=None, load="_classic_read"):
    #     print("=====================================")
    #     print("= read  model mixin       ===========")
    #     print("=====================================")
    #     print("fields: ", fields)
    #     print("load: ", load)
    #     # self.check_access_rule('read')
    #     return super().read(fields=fields, load=load)
    #
    # def fetch(self, field_names):
    #     print("=====================================")
    #     print("= fetch  model mixin      ===========")
    #     print("=====================================")
    #     print("field_names: ", field_names)
    #     # self = self.sudo()
    #     return super().fetch(field_names)
    #
    # @api.model
    # def _search(
    #     self, domain, offset=0, limit=None, order=None, access_rights_uid=None
    # ):
    #     print("=====================================")
    #     print("= _search  model mixin    ===========")
    #     print("=====================================")
    #     print("domain: ", domain)
    #     print("offset: ", offset)
    #     print("limit: ", limit)
    #     print("order: ", order)
    #     print("access_rights_uid: ", access_rights_uid)
    #
    #     res = super()._search(domain, offset, limit, order, access_rights_uid)
    #     print("res: ", res)
    #     return res
    #
    #     # # Rules do not apply to administrator
    #     # if self.env.is_superuser():
    #     #     return super()._search(
    #     #         domain, offset, limit, order, access_rights_uid
    #     #     )
    #     #
    #     # # Non-employee see only messages with a subtype and not internal
    #     # if not self.env["res.users"].has_group("base.group_user"):
    #     #     domain = self._get_search_domain_share() + domain
    #     #
    #     # # make the search query with the default rules
    #     # query = super()._search(domain, offset, limit, order, access_rights_uid)

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
        self.env["field.html.history.revision"].sudo().search(
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
