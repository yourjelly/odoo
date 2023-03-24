# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime
from odoo import api, fields, models, _
from odoo.tools.misc import _format_time_ago,clean_context
from difflib import SequenceMatcher
import json


# ------------------------------------------------------------
# History restoration methods
# ------------------------------------------------------------


def restore_one(current_content, diff_list):
    diff_list.reverse()
    current_content_list = current_content.split('<')

    for diff_data in diff_list:
        diff_data_split = diff_data.split('<')
        diff_split = diff_data_split[0].split('|', 1)
        diff_lines = diff_split[1].split(',', 1)

        tag_prefix = diff_split[0]
        line_id = int(diff_lines[0])
        end_line_id = int(diff_lines[1]) if len(diff_lines) > 1 else line_id
        line_index = line_id - 1

        text_diff = diff_data_split[1:] if len(diff_data_split) > 1 else []
        text_diff.reverse()

        if end_line_id > line_id:
            for lid in range(end_line_id, line_id, -1):
                if tag_prefix in ['-', 'R']:
                    del current_content_list[lid - 1]

        if tag_prefix in ['+', 'R']:
            for line_text in text_diff:
                current_content_list.insert(line_id, line_text)
        if tag_prefix in ['-', 'R']:
            del current_content_list[line_index]

    return '<'.join(current_content_list)

# ------------------------------------------------------------
# Custom difflib Diff methods
# ------------------------------------------------------------


def _format_range_context(start, stop):
    beginning = start + 1  # lines start numbering with one
    length = stop - start
    if not length:
        beginning -= 1  # empty ranges begin at line just before the range
    if length <= 1:
        return '{}'.format(beginning)
    return '{},{}'.format(beginning, beginning + length - 1)


def _custom_diff(new_content_str, old_content_str):
    new_content_lines = new_content_str.split('<')
    old_content_lines = old_content_str.split('<')

    prefix = dict(insert='+', delete='-', replace='R', equal='=')
    for group in SequenceMatcher(None, new_content_lines, old_content_lines, False).get_grouped_opcodes(0):
        diff_lines = []
        first, last = group[0], group[-1]
        diff_string = '|'

        diff_string += _format_range_context(first[1], last[2])
        if any(tag in {'replace', 'delete'} for tag, _, _, _, _ in group):
            for tag, i1, i2, _, _ in group:
                if tag not in {'insert', 'equal', 'replace'}:
                    diff_string = prefix[tag] + diff_string
        if any(tag in {'replace', 'insert'} for tag, _, _, _, _ in group):
            for tag, _, _, j1, j2 in group:
                if tag not in {'delete', 'equal'}:
                    diff_string = prefix[tag] + diff_string
                    for line in old_content_lines[j1:j2]:
                        diff_lines.append(line)
        if diff_lines:
            yield str(diff_string) + '<' + '<'.join(diff_lines)
        else:
            yield str(diff_string)


class HtmlHistory(models.Model):
    _name = "field.html.history"
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

    def restore_history_to(self, diff_id):
        """
        Restore the current article to a previous version.
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
            self.write({history_field_name: restored_content})

        return {
            'name': _("Restored content"),
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': self._name,
            'res_id': self.id
        }


class HtmlHistoryDiff(models.Model):
    _name = "field.html.history.diff"
    _description = "Field html History Diff"

    related_model = fields.Char('Related Document Model Name', required=True, index=True)
    related_id = fields.Many2oneReference('Related Document ID', index=True, model_field='related_model')

    diff = fields.Text(string="Diff", readonly=True)
    diff_size = fields.Integer('Diff size', compute='_compute_diff_size')
    time_ago = fields.Text(string="Diff created", compute="_compute_time_ago")

    @api.depends('diff')
    def _compute_diff_size(self):
        for history in self:
            history.diff_size = len(history.diff)

    @api.depends('create_date')
    def _compute_time_ago(self):
        for history in self:
            history.time_ago = _format_time_ago(self.env, (datetime.now() - history.create_date))

    @classmethod
    def get_diff(cls, new_body, old_body):
        return json.dumps(list(_custom_diff(new_body, old_body)))

    @classmethod
    def get_restored_version(cls, body, history_list):
        for history in history_list:
            body = restore_one(body, json.loads(history.diff))
        return body

    def action_restore_version(self):
        return self.env[self.related_model].browse([self.related_id]).restore_history_to(self.id)
