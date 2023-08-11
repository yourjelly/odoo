# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
import re

from datetime import datetime
from odoo import api, fields, models
from odoo.tools.misc import _format_time_ago
from difflib import SequenceMatcher


# ------------------------------------------------------------
# History restoration methods
# ------------------------------------------------------------

PATCH_SEPARATOR = '\n'
LINE_SEPARATOR = '<'

PATCH_OPERATION_LINE_AT = '@'

PATCH_OPERATION_ADD = '+'
PATCH_OPERATION_REMOVE = '-'
PATCH_OPERATION_REPLACE = 'R'


def apply_patch(initial_content, patch):
    """ Apply a patch (multiple operations) on a content.
        Each operation is a string with the following format:
        <operation_type>@<start_index>[,<end_index>][:<patch_text>*]
        patch format example:
            +@4:</p><p>ab</p><p>cd
            +@4,15:</p><p>ef</p><p>gh
            -@32
            -@125,129
            R@523:<b>sdf</b>

        :param string initial_content: the initial content to patch
        :param string patch: the patch to apply

        :return: string: the patched content
    """
    content = initial_content.split(LINE_SEPARATOR)
    patch_operations = patch.split(PATCH_SEPARATOR)
    # We need to apply operation from last to the first
    # to preserve the indexes integrity.
    patch_operations.reverse()

    for operation in patch_operations:
        metadata, *patch_content_line = operation.split(LINE_SEPARATOR)

        operation_type, lines_index_range = metadata.split(
            PATCH_OPERATION_LINE_AT)
        start_index, end_index = lines_index_range.split(',')
        start_index = int(start_index)
        end_index = int(end_index) if end_index else start_index
        base_index = start_index - 1

        # We need to insert lines from last to the first
        # to preserve the indexes integrity.
        patch_content_line.reverse()

        if end_index > start_index:
            for index in range(end_index, start_index, -1):
                if operation_type in [PATCH_OPERATION_REMOVE,
                                      PATCH_OPERATION_REPLACE]:
                    del content[index - 1]

        if operation_type in [PATCH_OPERATION_ADD, PATCH_OPERATION_REPLACE]:
            for line in patch_content_line:
                content.insert(start_index, line)
        if operation_type in [PATCH_OPERATION_REMOVE, PATCH_OPERATION_REPLACE]:
            del content[base_index]

    return LINE_SEPARATOR.join(content)


# ------------------------------------------------------------
# History Comparison methods
# ------------------------------------------------------------

HTML_TAG_ISOLATION_REGEX = r'^([^>]*>)(.*)$'
ADDITION_COMPARISON_REGEX = r'\1<diffadd>\2</diffadd>'
DELETION_COMPARISON_REGEX = r'\1<diffdel>\2</diffdel>'


def generate_comparison(initial_content, patch):
    """ Apply a patch on a content (see apply_patch for more details)
        and generate a comparison html between the initial content
        and the patched content.

        :param string initial_content: the initial content to patch
        :param string patch: the patch to apply

        :return: string: the comparison content
    """
    comparison = initial_content.split(LINE_SEPARATOR)
    patch_operations = patch.split(PATCH_SEPARATOR)
    # We need to apply operation from last to the first
    # to preserve the indexes integrity.
    patch_operations.reverse()

    for operation in patch_operations:
        metadata, *patch_content_line = operation.split(LINE_SEPARATOR)

        operation_type, lines_index_range = metadata.split(
            PATCH_OPERATION_LINE_AT)
        start_index, end_index = lines_index_range.split(',')
        start_index = int(start_index)
        end_index = int(end_index) if end_index else start_index
        base_index = start_index - 1

        # We need to insert lines from last to the first
        # to preserve the indexes integrity.
        patch_content_line.reverse()

        if end_index > start_index:
            for index in range(end_index, start_index, -1):
                if operation_type in [PATCH_OPERATION_REMOVE,
                                      PATCH_OPERATION_REPLACE]:
                    comparison[index - 1] = re.sub(
                        HTML_TAG_ISOLATION_REGEX,
                        DELETION_COMPARISON_REGEX,
                        comparison[index - 1])

        if operation_type in [PATCH_OPERATION_ADD, PATCH_OPERATION_REPLACE]:
            for line in patch_content_line:
                comparison.insert(
                    start_index, re.sub(
                        HTML_TAG_ISOLATION_REGEX,
                        ADDITION_COMPARISON_REGEX,
                        line))
                comparison.insert(start_index, line)
        if operation_type in [PATCH_OPERATION_REMOVE, PATCH_OPERATION_REPLACE]:
            comparison[start_index] = re.sub(
                        HTML_TAG_ISOLATION_REGEX,
                        DELETION_COMPARISON_REGEX,
                        comparison[start_index])

    return LINE_SEPARATOR.join(comparison)


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
    new_content_lines = new_content_str.split(LINE_SEPARATOR)
    old_content_lines = old_content_str.split(LINE_SEPARATOR)

    prefix = dict(insert=PATCH_OPERATION_ADD,
                  delete=PATCH_OPERATION_REMOVE,
                  replace=PATCH_OPERATION_REPLACE,
                  equal='=')

    for group in SequenceMatcher(None, new_content_lines,  old_content_lines,
                                 False).get_grouped_opcodes(0):
        diff_lines = []
        first, last = group[0], group[-1]
        diff_string = PATCH_OPERATION_LINE_AT

        diff_string += _format_range_context(first[1], last[2])
        if any(tag in {'replace', 'delete'} for tag, _, _, _, _ in group):
            for tag, _, _, _, _ in group:
                if tag not in {'insert', 'equal', 'replace'}:
                    diff_string = prefix[tag] + diff_string
        if any(tag in {'replace', 'insert'} for tag, _, _, _, _ in group):
            for tag, _, _, j1, j2 in group:
                if tag not in {'delete', 'equal'}:
                    diff_string = prefix[tag] + diff_string
                    for line in old_content_lines[j1:j2]:
                        diff_lines.append(line)
        if diff_lines:
            diff_lines_glued = LINE_SEPARATOR.join(diff_lines)
            yield str(diff_string) + LINE_SEPARATOR + diff_lines_glued
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
            content = apply_patch(content, json.loads(history.diff))
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
