# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _


class HtmlHistory(models.AbstractModel):
    _name = "field.html.history.mixin"
    _description = "Field html History"

    history_diff_ids = fields.One2many(
        "field.html.history.diff", "related_id", string="Body History",
        copy=True)

    def _get_html_history_field_name(self):
        """ This method should be overriden to return the name of the field to track """
        return False

    def write(self, vals):
        history_field_name = self._get_html_history_field_name()
        if history_field_name and history_field_name in vals:
            new_body_str = vals[history_field_name]
            """ Each change of body we need to create a diff for the history """
            if self.id and isinstance(new_body_str, str):
                old_body_str = getattr(self, history_field_name)
                if isinstance(old_body_str, str) and new_body_str != old_body_str:
                    diff = self.env['field.html.history.diff'].get_diff(new_body_str, old_body_str)
                    self.env['field.html.history.diff'].create({"related_id": self.id,
                                                                "related_model": self._name,
                                                                "diff": diff})

        return super().write(vals)

    def unlink(self):
        """ This override will delete all HtmlHistoryDiff related to this document """
        self.env['field.html.history.diff'].search([('related_id', 'in', self.ids)]).unlink()
        return super().unlink()

    # ------------------------------------------------------------
    # VIEW ACTIONS
    # ------------------------------------------------------------

    def action_related_history(self):
        self.ensure_one()
        return {
            'name': _("Related History"),
            'type': 'ir.actions.act_window',
            'view_mode': 'tree,form',
            'res_model': "field.html.history.diff",
            'domain': [('id', 'in', self.history_diff_ids.ids)]
        }

    # ------------------------------------------------------------
    # HISTORY Restoring
    # ------------------------------------------------------------

    def get_version_at(self, diff_id):
        """
        Get the current article version at a given time.
        :param int diff_id: id of the version diff to restore to
        """
        self.ensure_one()
        history_field_name = self._get_html_history_field_name()

        diff_to_restore = self.env['field.html.history.diff'].search(
            [('related_id', '=', self.id),
             ('related_model', '=', self._name),
             ('id', '>=', diff_id)], order='id desc')
        if len(diff_to_restore) > 0 and history_field_name:
            restored_content = self.env['field.html.history.diff'].get_restored_version(
                getattr(self, history_field_name), diff_to_restore)
            return restored_content
        return False

    def restore_history_to(self, diff_id):
        """
        Restore the current article to a previous version.
        :param int diff_id: id of the version diff to restore to
        """
        self.ensure_one()
        restored_content = self.get_version_at(diff_id)
        if restored_content:
             self.write({self._get_html_history_field_name(): restored_content})

        return {
            'name': _("Restored content"),
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': self._name,
            'res_id': self.id
        }

    # ------------------------------------------------------------
    # HISTORY comparison
    # ------------------------------------------------------------

    def get_version_comparison_at(self, diff_id):
        """
        Get a comparison between the current version and the version at diff_id
        :param int diff_id: id of the version diff to restore to
        """
        self.ensure_one()
        history_field_name = self._get_html_history_field_name()

        diff_to_restore = self.env['field.html.history.diff'].search(
            [('related_id', '=', self.id),
             ('related_model', '=', self._name),
             ('id', '>=', diff_id)], order='id desc')
        if len(diff_to_restore) > 0 and history_field_name:
            comparison = self.env['field.html.history.diff'].\
                get_comparison_version(getattr(self, history_field_name),
                                       diff_to_restore)
            return comparison
        return False
