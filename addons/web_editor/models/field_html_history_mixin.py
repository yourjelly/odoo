# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _

from .patch_utils import apply_patch, generate_comparison, generate_patch


class HtmlHistory(models.AbstractModel):
    _name = "field.html.history.mixin"
    _description = "Field html History"

    history_revision_ids = fields.One2many(
        "field.html.history.revision", "res_id", string="Related revision Ids",
        copy=True)

    def _get_versioned_field_names(self):
        """ This method should be overriden

            :return: list[string]: The names of the fields to be versioned
        """
        return []

    def write(self, vals):
        versioned_fields = self._get_versioned_field_names()
        for field_name in versioned_fields:
            if field_name not in vals:
                continue

            new_content = vals[field_name]
            if self.id and isinstance(new_content, str):
                old_content = getattr(self, field_name)
                if isinstance(old_content, str) and new_content != old_content:
                    patch = generate_patch(new_content, old_content)
                    self.env['field.html.history.revision'].create({
                        'res_id': self.id,
                        'res_model': self._name,
                        'res_field': field_name,
                        'patch': patch})

        return super().write(vals)

    def unlink(self):
        """ Delete all HtmlHistoryDiff related to this document """
        self.env['field.html.history.revision'].search(
            [('res_id', 'in', self.ids)]).unlink()
        return super().unlink()

    def get_revisions_for_field(self, field_name):
        """ Get the list of revision linked to the provided field name.
            Order from the most recent to the oldest.

            :param str field_name: the name of the field

            :return: list: list of revision
        """
        self.ensure_one()
        return self.env['field.html.history.revision'].search(
            [('res_id', '=', self.id),
             ('res_model', '=', self._name),
             ('res_field', '=', field_name)], order='id desc')

    def get_field_content_at_revision(self, field_name, revision_id):
        """ Get the requested field content restored until the revision_id.

            :param str field_name: the name of the field
            :param int revision_id: id of the last revision to restore

            :return: string: the restored content
        """
        self.ensure_one()
        revisions = self.env['field.html.history.revision'].search(
            [('res_id', '=', self.id),
             ('res_model', '=', self._name),
             ('res_field', '=', field_name),
             ('id', '>=', revision_id)], order='id desc')

        content = getattr(self, field_name)

        for revision in revisions:
            print("============================ revision =====================")
            print(revision)
            content = apply_patch(content, revision.patch) # todo : make sure revision.patch works

        return content

    def get_field_comparison_at_revision(self, field_name, revision_id):
        """ For the requested field,
            Get a comparison between the current content
            and the content at the restored until the revision_id.

            :param str field_name: the name of the field
            :param int revision_id: id of the last revision to compare

            :return: string: the comparison
        """
        self.ensure_one()
        content = getattr(self, field_name)
        restored_content = self.get_field_content_at_revision(
            field_name, revision_id)

        return generate_comparison(
            content, restored_content, ['data-last-history-steps'])
