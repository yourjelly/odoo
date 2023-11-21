import json
import logging
import time
from collections import defaultdict

from odoo import _, models, fields, api, Command
from odoo.tools import date_utils

CHUNK_SIZE = 10000
CACHES_PER_CRON_RUN = 7

_logger = logging.getLogger(__name__)


class PosCache(models.Model):
    _name = 'pos.cache'
    _description = 'Point of Sale Cache'

    model = fields.Char(required=True)
    domain = fields.Char(
        help='Domain to filter the cache. For example, if the cache is for price lists, it will be the domain used to filter the price lists for this config only.'
             'The benefit is that at the time of (re)loading the caches, we can use it to figure out if this cache can be shared.'
    )
    version = fields.Integer(
        default=0,
        help='Version of the cache. If the version is different than the highest on any cache, the cache will be refreshed.'
    )
    data_chunks = fields.One2many(
        comodel_name='pos.cache.data.chunk',
        inverse_name='cache_id',
    )
    # Some configs may share the same cache. For example, if they have the same price lists (based on the domain), they can share the same cache.
    config_ids = fields.Many2many(
        comodel_name='pos.config',
        relation='pos_config_cache_rel',
        column1='config_id',
        column2='cache_id',
        ondelete='cascade',
        string='Concerned POS Configs',
    )
    last_refresh_duration = fields.Char()
    last_refresh_date = fields.Datetime()
    cache_size = fields.Char(
        compute='_compute_cache_size',
    )

    @api.model
    def refresh_all_caches(self):
        """ Rebuild all caches.
        This is called by a CRON. if manual refresh is needed, it has to be done by triggering the cron.
        The reason why is that we are processing caches a few at a time, then rerun the cron to process the next batch.
        It ensures that there is no timeout, and that we don't have too much data in memory at once.
        """
        # 1) Get the existing caches, and use them to determine if we're in a new refresh or continuing one.
        existing_caches = self.env['pos.cache'].search([])
        if existing_caches:
            # Refreshing is based on version to handle progressive loading.
            # If all caches have the same version => we start refreshing.
            max_version = max(existing_caches.mapped('version'))
            new_refresh = all(c.version == max_version for c in existing_caches)
        else:
            max_version = 0
            new_refresh = True
        if new_refresh:
            _logger.info('Starting a new cache refresh.')
        else:
            _logger.info('Refreshing next batch of caches.')
        # 2) Get the configs, existing caches, and other relevant information such as the caches needing to be created.
        # If we are in a new refresh we may need to create new caches. When continuing a refresh, we only need to update existing caches.
        # If we are not, then we already did the creation/deletion/linking, and we just need to do the updating.
        if new_refresh:
            caches = self._get_caches_info(existing_caches)
        else:
            caches = existing_caches
        del existing_caches

        # Get the next few caches that are not of the new version. If we have more cache to update we restart the cron.
        # For each cache, we refresh the data using the pos session methods => This means any inherit still works.
        version = max_version + (1 if new_refresh else 0)
        need_more_run = len(caches.filtered(lambda c: c.version != version)) > CACHES_PER_CRON_RUN
        caches = caches.filtered(lambda c: c.version != version)[:CACHES_PER_CRON_RUN]
        caches_data = [(c.id, c.model, c.data_chunks.ids, c.config_ids[0]) for c in caches]
        caches.invalidate_model()  # Clear the cache, we do not want to keep references to the records data in memory.
        del caches
        for cache_id, model, chunk_ids, config_id in caches_data:
            start_time = time.time()
            _logger.info('Loading cache for model %s.', model)
            self._load_cache(cache_id, model, chunk_ids, config_id, version)
            self.browse(cache_id).write({
                'last_refresh_duration': f"{time.time() - start_time:.2f} seconds",
                'last_refresh_date': fields.Datetime.now(),
            })
            _logger.info('Finished loading cache for model %s in %s seconds.', model, time.time() - start_time)

        # Check if any cache is still not up to date. If so, we restart the cron.
        if need_more_run:
            self.env.ref('pos_cache.refresh_pos_caches_cron')._trigger()
        else:
            _logger.info('Cache refresh finished.')

    def _get_caches_info(self, existing_caches):
        # Loop on the configs. Find the caches that are correct for this config NOW based on the domain.
        # If the relationship is correct, we just need to update the cache.
        # If the relationship is not correct, and we don't find another cache matching the domain, we create one.
        caches_per_config = defaultdict(dict)
        caches_to_create = {}
        caches_to_update = self.env['pos.cache']
        for config in self.env['pos.config'].search([('use_cache', '=', True)]):
            session = self.env['pos.session'].new({'config_id': config}).with_context(loading_cache=True)
            for model in self.env.company.point_of_sale_models_to_cache.mapped('model'):
                # Start by getting the domain for this config and model.
                params = getattr(session, '_loader_params_%s' % model.replace('.', '_'), None)
                domain = params().get('search_params').get('domain', [])
                related_caches = existing_caches.filtered(
                    lambda c: c.model == model and c.domain == str(domain) and config in c.config_ids)
                if related_caches:
                    caches_per_config[config][model] = related_caches[0]  # Existing AND already linked. The relationship doesn't need to be changed.
                    caches_to_update |= related_caches[0]
                else:
                    caches_per_config[config][model] = False  # Either we do not have a cache for this domain yet, or it is not linked to this config.
                    existing_cache_for_config = existing_caches.filtered(lambda c: c.model == model and c.domain == str(domain))
                    if not existing_cache_for_config:
                        if any(c['model'] == model and c['domain'] == str(domain) for c in caches_to_create.values()):
                            caches_to_create[f'{model}_{domain}']['config_ids'].append(Command.link(config.id))
                        else:
                            caches_to_create[f'{model}_{domain}'] = {
                                'model': model,
                                'domain': str(domain),
                                'config_ids': [Command.link(config.id)],
                            }
                    else:
                        caches_to_update |= existing_cache_for_config[0]
                        # Link our config to the existing cache.
                        existing_cache_for_config[0].config_ids |= config

        # At this point, we now have the list of caches needing update and the one needing creation.
        # The link should be done accordingly already: the one to create have the config_ids set, and the one to update have the config_ids updated.
        # We can start by creating the missing ones, then we will loop and update all caches.
        caches = self.env['pos.cache'].create(list(caches_to_create.values()))
        caches |= caches_to_update
        # At this point, caches contains all used caches. We can compare with existing_caches to find the ones that are not used anymore.
        caches_to_delete = existing_caches - caches
        if caches_to_delete:
            caches_to_delete.unlink()
        # Already commit the caches creation and deletion.
        self.env.cr.commit()

        return caches

    def _load_cache(self, cache_id, cache_model, existing_chunk_ids, config_id, version):
        """ Load the cache for the given model, and update the cache version if needed. """
        # We can now update the caches. We can use any config on them for that purpose since the domain is the same.
        session = self.env['pos.session'].new({'config_id': config_id})
        # Get data we need from the cache object then delete it from the memory
        chunk_index = 0
        data = session.with_context(loading_cache=True, chunk_index=chunk_index)._load_model(cache_model)
        while data:
            if existing_chunk_ids and len(existing_chunk_ids) > chunk_index:
                self.env['pos.cache.data.chunk'].browse(existing_chunk_ids[chunk_index]).write({
                    'data': json.dumps(data, ensure_ascii=False, default=date_utils.json_default),
                })
            else:
                self.env['pos.cache.data.chunk'].create({
                    'data': json.dumps(data, ensure_ascii=False, default=date_utils.json_default),
                    'cache_id': cache_id,
                })
            _logger.info('Chunk %s created for model %s.', chunk_index, cache_model)
            chunk_index += 1
            # Clear the cache of any data we might have loaded.
            # We don't need it anymore and for very large table, it may even lead to memory exceptions.
            self.env[cache_model].invalidate_model()
            data = session.with_context(loading_cache=True, chunk_index=chunk_index)._load_model(cache_model)
        # If we still have chunks which did not get written on, we can delete them.
        if chunk_index < len(existing_chunk_ids):
            self.env['pos.cache.data.chunk'].browse(existing_chunk_ids[chunk_index:]).unlink()

        # Finally update the cache version.
        self.env['pos.cache'].browse(cache_id).write({
            'version': version,
        })
        self.env.cr.commit()

    def _compute_cache_size(self):
        """ No dependencies, only computed for the list view."""
        self.env.cr.execute("""
            SELECT chunk.cache_id, sum(length(chunk.data::text))
            FROM pos_cache_data_chunk AS chunk
            WHERE cache_id in %s
            GROUP BY chunk.cache_id
        """, [tuple(self.ids)])
        cache_sizes = dict(self.env.cr.fetchall())
        for cache in self:
            # Get the cache size in bytes from the database and convert it in mb, rounded to two decimals.
            cache.cache_size = f"{round(cache_sizes.get(cache.id, 0) / 1024 / 1024, 2)} MB"

    def action_pos_hard_reset_cache(self):
        self.env['pos.cache'].search([]).unlink()
        # Using method_direct_trigger, we do not queue the cron and just run directly.
        self.env.ref('pos_cache.refresh_pos_caches_cron').method_direct_trigger()

    def action_refresh_cache(self):
        start_time = time.time()
        _logger.info('Loading cache for model %s.', self.model)
        self._load_cache(self.id, self.model, self.data_chunks.ids, self.config_ids, self.version)
        self.write({
            'last_refresh_duration': f"{time.time() - start_time:.2f} seconds",
            'last_refresh_date': fields.Datetime.now(),
        })
        _logger.info('Finished loading cache for model %s in %s seconds.', self.model, time.time() - start_time)


class PosCacheDataChunk(models.Model):
    _name = 'pos.cache.data.chunk'
    _description = 'Point of Sale Cache Data Chunk'

    data = fields.Char()  # Using a Json field is either very much slower if we store a dict, or repeating the load if we store a string.
    cache_id = fields.Many2one(
        comodel_name='pos.cache',
        ondelete='cascade',
    )


class PosConfig(models.Model):
    _inherit = 'pos.config'

    use_cache = fields.Boolean(
        default=True,
        help="If checked, the data will be cached in the database to improve the performances."
    )


class PosSession(models.Model):
    _inherit = 'pos.session'

    def _load_model(self, model):
        """ Overriden to use the cache if needed and possible. """
        model_name = model.replace('.', '_')
        # Needs to be sudoed as this could be called by a user without read rights on ir.model.
        models_from_cache = self.env.company.sudo().point_of_sale_models_to_cache.mapped('model')
        if self.config_id.use_cache and not self._context.get('loading_cache') and model in models_from_cache:
            chunk = self.load_next_chunk(0, model)
            if chunk:
                return chunk[model]

        loader = getattr(self, '_get_pos_ui_%s' % model_name, None)
        params = getattr(self, '_loader_params_%s' % model_name, None)
        if loader and params:
            params = params()
            if self._context.get('loading_cache') and self._context.get('chunk_index') is not False and model in models_from_cache:
                params['search_params']['offset'] = self._context['chunk_index'] * CHUNK_SIZE
                params['search_params']['limit'] = CHUNK_SIZE
            return loader(params)
        else:
            raise NotImplementedError(_("The function to load %s has not been implemented.", model))

    def load_next_chunk(self, offset, model=False):
        data = defaultdict(list)
        models = [model] if model else self.env.company.sudo().point_of_sale_models_to_cache.mapped('model')
        caches = self.env['pos.cache'].search_read(
            [('config_ids', 'in', self.config_id.id), ('model', 'in', models)],
            ['data_chunks', 'model'],
            load=None,
        )
        for model in models:
            cache = [c for c in caches if c['model'] == model]
            if not cache:  # This model should be cached but is not. We are thus using the legacy system and this load is ignored.
                return False
            if len(cache[0]['data_chunks']) > offset:
                chunk = self.env['pos.cache.data.chunk'].browse(cache[0]['data_chunks'][offset])
                data[model].extend(json.loads(chunk.data))
        return data or False
