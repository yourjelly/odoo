# -*- coding: utf-8 -*-
from odoo import models, api


class AccountOrmMixin(models.AbstractModel):
    _name = 'account.orm.mixin'
    _description = "Hack of the ORM to cleanup onchanges on account.move"

    def _field_will_change(self, vals, field_name):
        if field_name not in vals:
            return False
        field = self._fields[field_name]
        if field.type == 'many2one':
            return self[field_name].id != vals[field_name]
        if field.type == 'many2many':
            current_ids = set(self[field_name].ids)
            after_write_ids = set(self.new({field_name: vals[field_name]})[field_name].ids)
            return current_ids != after_write_ids
        if field.type == 'one2many':
            return vals.get(field_name)
        if field.type == 'monetary' and self[field.currency_field]:
            return not self[field.currency_field].is_zero(self[field_name] - vals[field_name])
        return self[field_name] != vals[field_name]

    @api.model
    def _cleanup_write_orm_values(self, record, vals):
        cleaned_vals = dict(vals)
        for field_name, value in vals.items():
            if not self._field_will_change(vals, field_name):
                del cleaned_vals[field_name]
        return cleaned_vals

    def _friendly_write(self, vals):
        in_draft_mode = self != self._origin

        if in_draft_mode:

            new_vals = dict(vals)
            for fieldname, value in vals.items():
                field = self._fields[fieldname]
                if field.type == 'one2many':
                    line_ids_commands = new_vals.pop(fieldname)

                    for command in line_ids_commands:
                        number = command[0]
                        record_id = command[1]

                        if number == 0:
                            self.env[field.comodel_name].new(command[2])
                        elif number == 1:
                            updated_line = self[fieldname].filtered(lambda record: str(record.id) == str(record_id))
                            updated_line.update(command[2])
                        elif number == 2:
                            to_delete_record = self[fieldname].filtered(lambda record: str(record.id) == str(record_id))
                            self[fieldname] -= to_delete_record

            self.update(new_vals)
        else:
            self.write(vals)

    @api.model
    def _get_tracked_orm_fields(self):
        return []

    @api.model
    def _pre_create(self, vals_list, store=True):
        pass

    def _post_create(self, vals_list, store=True):
        pass

    @api.model_create_multi
    def create(self, vals_list):
        # OVERRIDE
        self._pre_create(vals_list, store=True)
        records = super().create(vals_list)
        records._post_create(vals_list, store=True)
        return records

    @api.model
    def new(self, values={}, origin=None, ref=None):
        # OVERRIDE
        self._pre_create([values], store=False)
        record = super().new(values=values, origin=origin, ref=ref)
        record._post_create([values], store=False)
        return record

    def _pre_write(self, vals_list):
        pass

    def _post_write(self, vals_list, changed_fields_list):
        pass

    def write(self, vals):
        # OVERRIDE

        # Avoid writing the same value on record to don't fuck up the computable editable fields.

        cleaned_vals_list = []
        records = self.env[self._name]
        for record in self:
            cleaned_vals = self._cleanup_write_orm_values(record, vals)
            if cleaned_vals:
                cleaned_vals_list.append(cleaned_vals)
                records |= record

        # As the 'write' methods could be complex regarding some override, we avoid a huge overhead
        # due to recursive calls by calling two hooks '_pre_write' / '_post_write' that are called
        # only once.

        # Hook: Prepare to write some values.
        tracked_vals_list = []
        tracked_fieldnames = self._get_tracked_orm_fields()
        if not self._context.get('write_recursion'):
            records.with_context(write_recursion=True)._pre_write(cleaned_vals_list)
            for record in records:
                tracked_vals_list.append({fieldname: record.mapped(fieldname) for fieldname in tracked_fieldnames})

        # Classic write: Batch vals if possible.
        if cleaned_vals_list and all(cleaned_vals == cleaned_vals_list[0] for cleaned_vals in cleaned_vals_list):
            res = super(AccountOrmMixin, records).write(cleaned_vals_list[0])
        else:
            res = True
            for record, cleaned_vals in zip(records, cleaned_vals_list):
                res |= super(AccountOrmMixin, record).write(cleaned_vals)

        # Hook: Post-processing.
        if not self._context.get('write_recursion'):
            changed_fields_list = []
            for record, tracked_vals in zip(records, tracked_vals_list):
                changed_vals = set()
                for fieldname in tracked_fieldnames:
                    value = record.mapped(fieldname)
                    if value != tracked_vals[fieldname]:
                        changed_vals.add(fieldname)
                changed_fields_list.append(changed_vals)

            records.with_context(write_recursion=True)._post_write(cleaned_vals_list, changed_fields_list)

        return res

    def _pre_onchange(self, changed_fields):
        pass

    def _post_onchange(self, changed_fields):
        pass

    def _perform_onchanges(self, nametree, snapshot0, todo, field_onchange):
        # OVERRIDE
        self.ensure_one()

        # Hook: Prepare to onchange.
        self._pre_onchange(set(todo))

        tracked_fieldnames = self._get_tracked_orm_fields()
        tracked_vals = {fieldname: self.mapped(fieldname) for fieldname in tracked_fieldnames}

        res = super()._perform_onchanges(nametree, snapshot0, todo, field_onchange)

        changed_vals = set()
        for fieldname in tracked_fieldnames:
            value = self.mapped(fieldname)
            if value != tracked_vals[fieldname]:
                changed_vals.add(fieldname)

        # Hook: Post-onchange.
        self._post_onchange(changed_vals)

        return res
