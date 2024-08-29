# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64

from odoo import models, fields


fname_skip =['create_uid', 'write_uid', 'create_date', 'write_date', 'id']
tab = '    '


class BaseExportData(models.TransientModel):
    _name = 'base.export.data'

    name = fields.Char('File Name')
    data = fields.Binary('File', attachment=False)
    record_ids = fields.One2many('base.export.data.line', 'wizard_id', readonly=False)
    get = fields.Boolean(default=False)

    def xml_file(self):
        self.write({
            'get': True,
            'name': 'data.xml',
            'data': base64.b64encode(bytes(self._make_demo_data(), 'utf-8'))
        })
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'base.export.data',
            'view_mode': 'form',
            'res_id': self.id,
            'views': [(False, 'form')],
            'target': 'new',
        }

    def _make_demo_data(self):
        record_demo_data = []
        done = {}
        for record in self.record_ids:
            demo_data, done = record._make_res_demo_data(done)
            record_demo_data += demo_data
        return f"""<?xml version="1.0" encoding="UTF-8"?>\n<odoo>\n{tab}<data noupdate="1">%s\n{tab}</data>\n</odoo>\n""" % '\n'.join(record_demo_data)


class BaseExportDataLine(models.TransientModel):
    _name = 'base.export.data.line'

    wizard_id = fields.Many2one('base.export.data')
    res_model_id = fields.Many2one('ir.model', string='Model', required=True)
    res_model = fields.Char(related='res_model_id.model')
    res_id = fields.Many2oneReference('Res ID', model_field='res_model', required=True)

    def _make_res_demo_data(self, done=None):
        record = self.env[self.res_model].browse(self.res_id)
        return self._make_one_demo_data(record, done)

    def _make_one_demo_data(self, record, done=None):
        record.ensure_one()
        if record in done:
            return [], done

        if done is None:
            done = {}

        name = getattr(record, 'display_name', None)
        if not name:
            name = f'{record._name}_{record.id}'
        name = name.replace('.', '_').replace(',', '_').replace(' ', '_').lower()
        # TODO maybe name deduplication ?
        done[record] = name

        fields = record.fields_get()
        defaults = record.default_get(fields)
        fields_data = []
        x2ms, m2os = [], []

        for fname, settings in fields.items():
            if fname in fname_skip:
                continue

            if not settings['store'] or settings.get('related', False):
                continue

            if settings['type'] == 'many2one':
                # TODO circular relation
                relational = getattr(record, fname)
                if not relational or defaults.get(fname) == relational.id:
                    continue
                if ref := self.exists_data(relational):
                    done[relational] = ref
                else:
                    data, done = self._make_one_demo_data(relational, done)
                    m2os += data
                fields_data += [f"\n{tab*3}<field name='{fname}' ref='{done[relational]}'/>"]

            elif settings['type'] in ['one2many', 'many2many']:
                relationals = getattr(record, fname)
                for relational in relationals:
                    if not relational or defaults.get(fname) == relational.id:
                        continue
                    data, done = self._make_one_demo_data(relational, done)
                    x2ms += data

            else:
                value = getattr(record, fname)
                if defaults.get(fname) == value:
                    continue
                if settings['type'] == 'bool':
                    value = int(value)
                fields_data += [f"\n{tab*3}<field name='{fname}'>{value}</field>"]

        record_data = f"""\n{tab*2}<record id='{name}' model='{record._name}'>{"".join(fields_data)}\n{tab*2}</record>"""
        return m2os + [record_data] + x2ms, done

    def exists_data(self, record):
        # TODO see why limit 1 is necessary :/
        data = self.env['ir.model.data'].search([('model', '=', record._name), ('res_id', '=', record.id)], limit=1)
        return data and (data.module + '.' + data.name)
