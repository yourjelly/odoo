# -*- coding: utf-8 -*-
from odoo import models, api

import re


class Snapshot:
    def __init__(self, record, fieldnames):
        self.record = record
        self.values = {}

        for fieldname in fieldnames:
            compiler = re.compile(r'(\w+){((?:\w+\s*,{0,1}\s*)+)}')
            res = compiler.search(fieldname)
            if res:
                rel_fieldname, sub_fieldnames_str = res.groups()
                sub_fieldnames = sub_fieldnames_str.replace(' ', '').split(',')

                self.values[rel_fieldname] = [Snapshot(sub_record, sub_fieldnames) for sub_record in self.record[rel_fieldname]]
            else:
                self.values[fieldname] = self.record[fieldname]

    def snapshot_field_has_changed(self, snapshot, fieldnames):
        for fieldname in fieldnames:
            compiler = re.compile(r'(\w+){((?:\w+\s*,{0,1}\s*)+)}')
            res = compiler.search(fieldname)
            if res:
                rel_fieldname, sub_fieldnames_str = res.groups()
                sub_fieldnames = sub_fieldnames_str.replace(' ', '').split(',')

                if len(self.values[rel_fieldname]) != len(snapshot.values[rel_fieldname]):
                    return True

                for sub_snapshot0, sub_snapshot1 in zip(self.values[rel_fieldname], snapshot.values[rel_fieldname]):
                    if sub_snapshot0.snapshot_field_has_changed(sub_snapshot1, sub_fieldnames):
                        return True
            else:
                if self.values[fieldname] != snapshot.values[fieldname]:
                    return True

        return False

    def field_has_changed(self, fieldnames):
        return self.snapshot_field_has_changed(Snapshot(self.record, fieldnames), fieldnames)


class OrmUtils:

    def __init__(self, record):
        self.record = record
        self.env = record.env

    def create_snapshot(self, fieldnames):
        return Snapshot(self.record, fieldnames)

    def cleanup_write_values(self, vals):
        cleaned_vals = dict(vals)
        for fieldname, value in vals.items():
            field = self.record._fields[fieldname]

            if field.type == 'many2one':
                if self.record[fieldname].id == vals[fieldname]:
                    del cleaned_vals[fieldname]
            elif field.type == 'many2many':
                current_ids = set(self.record[fieldname].ids)
                after_write_ids = set(self.record.new({fieldname: vals[fieldname]})[fieldname].ids)
                if current_ids == after_write_ids:
                    del cleaned_vals[fieldname]
            elif field.type == 'one2many':
                o2m_commands = vals[fieldname]
                new_o2m_commands = []
                for command in o2m_commands:
                    if command[0] == 1:
                        orm_utils = OrmUtils(self.env[field.comodel_name].browse(command[1]))
                        new_vals = orm_utils.cleanup_write_values(command[2])
                        command = (command[0], command[1], new_vals)
                    new_o2m_commands.append(command)
                cleaned_vals[fieldname] = new_o2m_commands
            elif field.type == 'monetary' and self.record[field.currency_field]:
                if self.record[field.currency_field].is_zero(self.record[fieldname] - vals[fieldname]):
                    del cleaned_vals[fieldname]
            elif self.record[fieldname] == vals[fieldname]:
                del cleaned_vals[fieldname]
        return cleaned_vals

    def write(self, vals):
        record = self.record
        in_draft_mode = record != record._origin

        if in_draft_mode:

            new_vals = dict(vals)
            for fieldname, value in vals.items():
                field = record._fields[fieldname]
                if field.type == 'one2many':
                    line_ids_commands = new_vals.pop(fieldname)

                    for command in line_ids_commands:
                        number = command[0]
                        record_id = command[1]

                        if number == 0:
                            self.env[field.comodel_name].new(command[2])
                        elif number == 1:
                            updated_line = record[fieldname].filtered(lambda record: str(record.id) == str(record_id))
                            updated_line.update(command[2])
                        elif number == 2:
                            to_delete_record = record[fieldname].filtered(lambda record: str(record.id) == str(record_id))
                            record[fieldname] -= to_delete_record

            record.update(new_vals)
        else:
            record.write(vals)
