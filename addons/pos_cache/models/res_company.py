from odoo import Command, models, fields


class ResCompany(models.Model):
    _inherit = 'res.company'

    point_of_sale_models_to_cache = fields.Many2many(
        'ir.model',
        relation='pos_cache_company_ir_model_rel',
        string='Models to cache',
        compute='_compute_default_point_of_sale_models_to_cache',
        store=True,
        readonly=False,
        precompute=True,
        help="All the models on this list will be cached, and the cache will be used when loading the PoS."
             "Please note that changing this value will trigger a complete rebuild of the cache."
    )

    def _compute_default_point_of_sale_models_to_cache(self):
        """ No depends and stored, so this will only be used once when initially setting the value. """
        default_models_to_cache = self.env['ir.model'].search(
            [('model', 'in', ['product.product', 'res.partner'])]
        )
        for record in self.filtered(lambda r: not r.point_of_sale_models_to_cache):
            record.point_of_sale_models_to_cache = [Command.set(default_models_to_cache.ids)]

    def write(self, vals):
        res = super(ResCompany, self).write(vals)
        if 'point_of_sale_models_to_cache' in vals:
            self.env['pos.cache'].action_pos_hard_reset_cache()
        return res
