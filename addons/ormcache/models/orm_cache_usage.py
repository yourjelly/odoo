# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api
from odoo.tools import ormcache_usage
from odoo.tools.cache import get_memory_footprint


class OrmCacheUsage(models.Model):
    _name = 'orm.cache.usage'
    _description = 'ORM Cache Usage'

    cache_name = fields.Char(required=True)
    model_name = fields.Char(required=True)
    method_name = fields.Char(required=True)
    args = fields.Text(required=True)
    largest_size = fields.Integer(aggregator="avg")
    largest_gen_time = fields.Float(aggregator="avg")
    total_hit = fields.Integer()
    in_cache = fields.Float(aggregator="avg")
    uid_arg = fields.Float(aggregator="avg")
    product_template_arg = fields.Float(aggregator="avg")

    @api.model
    def update_usage(self):
        self.env.cr.execute('DELETE FROM orm_cache_usage')
        vals_list = []
        caches = self.env.registry._Registry__caches
        for [cache_name, key], [size, hit, gen_time, uid_arg, self_arg] in ormcache_usage.items():
            model_name, method, *rest = key
            vals_list.append({
                'cache_name': cache_name,
                'model_name': model_name,
                'method_name': method.__name__,
                'args': str(rest),
                'largest_size': size,
                'largest_gen_time': gen_time * 1000,
                'total_hit': hit,
                'in_cache': float(key in caches[cache_name]),
                'uid_arg': float(uid_arg or model_name == 'res.users'),
                'product_template_arg': float(model_name == 'product_template' and self_arg)
            })
        self.create(vals_list)

    @api.model
    def get_registry_size(self):
        return get_memory_footprint(dict(self.env.registry))

    @api.model
    def cleanup_usage(self):
        self.env.cr.execute('DELETE FROM orm_cache_usage')
        self.env.registry.clear_all_caches()
        ormcache_usage.clear()

    @api.model
    def get_ormcache_usage(self):
        caches = self.env.registry._Registry__caches
        msg = ''
        for cache_name, cache in caches.items():
            msg += f'cache_name: {cache_name}, size: {len(cache)}, footprint: {get_memory_footprint(cache)}\n'
        msg += f'all footprint: {get_memory_footprint(caches)}'
        return msg