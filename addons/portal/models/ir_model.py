# -*- coding: utf-8 -*-
from odoo import _, api, fields, models


class IrModel(models.AbstractModel):
    _inherit = 'ir.model'

    is_portal_mixin = fields.Boolean(string="Poral Mixin", default=False,help="Whether this model supports messages and notifications of portal.",)

    def write(self, vals):
        if self and ('is_portal_mixin' in vals):
            if not all(rec.state == 'manual' for rec in self):
                raise UserError(_('Only custom models can be modified.'))
            if 'is_portal_mixin' in vals and not all(rec.is_portal_mixin <= vals['is_portal_mixin'] for rec in self):
                raise UserError(_('Field "Portal" cannot be changed to "False".'))
            res = super(IrModel, self).write(vals)
            self.flush()
            # setup models; this reloads custom models in registry
            self.pool.setup_models(self._cr)
            # update database schema of models
            models = self.pool.descendants(self.mapped('model'), '_inherits')
            self.pool.init_models(self._cr, models, dict(self._context, update_custom_fields=True))
        else:
            res = super(IrModel, self).write(vals)
        return res

    def _reflect_model_params(self, model):
        vals = super(IrModel, self)._reflect_model_params(model)
        vals['is_portal_mixin'] = issubclass(type(model), self.pool['portal.mixin'])
        return vals

    @api.model
    def _instanciate(self, model_data):
        model_class = super(IrModel, self)._instanciate(model_data)
        if model_data.get('is_portal_mixin') and model_class._name != 'portal.mixin':
            parents = model_class._inherit or []
            parents = [parents] if isinstance(parents, str) else parents
            model_class._inherit = parents + ['portal.mixin']
        return model_class
