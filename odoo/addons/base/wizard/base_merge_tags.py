# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, models, fields, _
from odoo.exceptions import UserError


TAG_MODELS = [('crm.lead.tag', 'crm.lead.tag'),
              ('fleet.vehicle.tag', 'fleet.vehicle.tag'),
              ('hr.employee.category', 'hr.employee.category'),
              ('mail.mass_mailing.tag', 'mail.mass_mailing.tag'),
              ('note.tag', 'note.tag'),
              ('project.tags', 'project.tags')]


class BaseMergeTags(models.TransientModel):
    _name = 'base.merge.tags'

    model_name = fields.Char(required=True, readonly=True)
    model_id = fields.Many2one('ir.model', compute='_compute_model_id', required=True, readonly=True)
    tag_to_merge = fields.Reference(selection=TAG_MODELS, required=True, readonly=True)
    destination_tag = fields.Reference(selection=TAG_MODELS, required=True, readonly=True)

    @api.depends('model_name')
    def _compute_model_id(self):
        IrModel = self.env['ir.model']
        for w in self:
            w.model_id = IrModel.search([('model', '=', w.model_name)], limit=1).id

    @api.model
    def default_get(self, fields_list):
        res = super(BaseMergeTags, self).default_get(fields_list)
        if not self._context['active_model'] in [m[0] for m in TAG_MODELS]:
            raise UserError(_('You cannot merge those records as they do not represent tags.'))
        if len(self._context['active_ids']) != 2:
            raise UserError(_('Please select exactly 2 tags for merge.'))
        model_name = self._context['active_model']
        tag_to_merge = '%s,%d' % (model_name, self._context['active_ids'][0])
        destination_tag = '%s,%d' % (model_name, self._context['active_ids'][1])
        res.update(model_name=model_name, tag_to_merge=tag_to_merge, destination_tag=destination_tag)
        return res

    def action_merge_tags(self):
        self.ensure_one()
        IrModelFields = self.env['ir.model.fields']
        fields_that_reference_the_tag = IrModelFields.search([('ttype', '=', 'many2many'), ('relation', '=', self.model_name)])
        for field in fields_that_reference_the_tag:
            records = self.env[field.model].search([(field.name, 'in', self.tag_to_merge.id)])
            records.write({field.name: [(4, self.destination_tag.id, None), (3, self.tag_to_merge.id, None)]})
        self.tag_to_merge.unlink()
        return {}
