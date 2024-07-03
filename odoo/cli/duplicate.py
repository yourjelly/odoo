# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
import optparse
import sys
import time
from pathlib import Path
from . import Command
import odoo
from odoo.tools.duplicate import duplicate_model, SQL_VARIATION_FUNCTIONS
from odoo.tools.misc import OrderedSet
from odoo.tools.sql import SQL

DEFAULT_FACTOR = 1
_logger = logging.getLogger(__name__)


class Duplicate(Command):
    """Duplicate existing data for testing/demo purposes"""

    def run(self, cmdargs):
        parser = odoo.tools.config.parser
        parser.prog = f'{Path(sys.argv[0]).name} {self.name}'
        group = optparse.OptionGroup(parser, "Duplicate Configuration")
        group.add_option("--factors", dest="factors",
                        help="Duplicate models by given factors. A factor of 3 will duplicate the given model 2³ times.")
        group.add_option("--models",
                         dest='duplicate_models',
                         help="Comma separated list of models")
        group.add_option("--unlogged", dest="unlogged", action="store_true",
                         help="Set all tables in the database as UNLOGGED. UNLOGGED tables don't write to the WAL so this leaves the database not "
                              "safe on crashes but provides a ~200%% speedup.")
        opt = odoo.tools.config.parse_config(cmdargs)
        duplicate_models = opt.duplicate_models and OrderedSet(opt.duplicate_models.split(','))
        factors = opt.factors and [int(f) for f in opt.factors.split(',')]
        if factors:
            factors += [DEFAULT_FACTOR for _ in range(len(duplicate_models) - len(factors))]
        else:
            factors = [DEFAULT_FACTOR for _ in range(len(duplicate_models))]
        dbname = odoo.tools.config['db_name']
        registry = odoo.registry(dbname)
        with registry.cursor() as cr:
            env = odoo.api.Environment(cr, odoo.SUPERUSER_ID, {'active_test': False})
            self.duplicate(env, factors, duplicate_models, opt.unlogged)

    @classmethod
    def _switch_database_unlogged(unlogged=False):
        pass

    @classmethod
    def duplicate(cls, env, factors, model_names, unlogged=False):
        registry = env.registry
        try:
            if unlogged:
                cls._switch_database_unlogged(unlogged)
            models = sorted(
                [m for m in env.values() if m._name in model_names and not (m._transient and m._abstract)],
                key=lambda m: list(model_names).index(m._name)
            )
            registry.duplication_done_for_model = {}.fromkeys([m._name for m in models], False)
            factors = dict(zip([m._name for m in models], factors))
            env.cr.execute(''';'''.join(SQL_VARIATION_FUNCTIONS.values()))

            _logger.log(25, 'Duplicating models %s', models)
            t0 = time.time()
            duplicate_model(models, factors)
            env.flush_all()
            model_time = time.time() - t0
            _logger.info('Duplicated models %s (total: %fs)', models, model_time)
        except:
            _logger.exception('Error while duplicating database models')
        finally:
            env.cr.execute(SQL(';').join(SQL('''DROP FUNCTION IF EXISTS %s''', SQL.identifier(funcname)) for funcname in SQL_VARIATION_FUNCTIONS))
            del registry.duplication_done_for_model
