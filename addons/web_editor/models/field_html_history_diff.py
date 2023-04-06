# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime
from odoo import api, fields, models
from odoo.tools.misc import _format_time_ago
from difflib import SequenceMatcher
import json, re


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
# History Comparison methods
# ------------------------------------------------------------


def compare_one(current_content, diff_list):
    diff_list.reverse()
    current_content_list = str(current_content).split('<')

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
                    current_content_list[lid - 1] = re.sub(
                        r'^([^>]*>)(.*)$',
                        r'\1<diffdel>\2</diffdel>',
                        current_content_list[lid - 1])

        if tag_prefix in ['+', 'R']:
            for line_text in text_diff:
                current_content_list.insert(
                    line_id, re.sub(
                        r'^([^>]*>)(.*)$',
                        r'\1<diffadd>\2</diffadd>',
                        line_text))
        if tag_prefix in ['-', 'R']:
            current_content_list[line_index] = re.sub(
                        r'^([^>]*>)(.*)$',
                        r'\1<diffdel>\2</diffdel>',
                        current_content_list[line_index])

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


class HtmlHistoryDiff(models.Model):
    _name = "field.html.history.diff"
    _description = "Field html History Diff"

    related_model = fields.Char('Related Document Model Name',
                                required=True, index=True)
    related_id = fields.Many2oneReference('Related Document ID',
                                          index=True,
                                          model_field='related_model')

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
            history.time_ago = _format_time_ago(
                self.env, (datetime.now() - history.create_date))

    @classmethod
    def get_diff(cls, new_content, old_content):
        return json.dumps(list(_custom_diff(new_content, old_content)))

    @classmethod
    def get_restored_version(cls, content, history_list):
        for history in history_list:
            content = restore_one(content, json.loads(history.diff))
        return content

    @classmethod
    def get_comparison_version(cls, content, history_list):
        old_content = cls.get_restored_version(content, history_list)
        diff_all = json.loads(cls.get_diff(content, old_content))

        comparison = compare_one(content, diff_all)
        return comparison

    def action_restore_version(self):
        return self.env[self.related_model].browse(
            [self.related_id]).restore_history_to(self.id)

    def get_version(self):
        return self.env[self.related_model].browse(
            [self.related_id]).get_version_at(self.id)

    def get_comparison(self):
        return self.env[self.related_model].browse(
            [self.related_id]).get_version_comparison_at(self.id)
