# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

""" Models registries.

"""
import collections
import contextlib
from functools import partial
from operator import attrgetter
from weakref import WeakValueDictionary
import itertools
import logging
import os
import sys
import threading
import time

import odoo
from .. import api, SUPERUSER_ID
from odoo.tools import (assertion_report, config, existing_tables,
                        lazy_classproperty, lazy_property, table_exists,
                        convert_file, ustr, lru,
                        topological_sort, OrderedSet, pycompat)
from . import db, graph, migration, module

import pytest
import _pytest.main
import _pytest.python
import py.code
import py.error
import py.path
# pytest treats no tests found as a failure, if a module has no tests there's
# no tests collected so that's no failure for us. Cf pytest-dev/pytest#812
FAILURES = (
    _pytest.main.EXIT_TESTSFAILED,
    _pytest.main.EXIT_INTERNALERROR,
    _pytest.main.EXIT_USAGEERROR,
)


_logger = logging.getLogger(__name__)
_test_logger = logging.getLogger('odoo.tests')


class OdooTestModule(_pytest.python.Module):
    """ Should only be invoked for paths inside Odoo addons
    """
    def _importtestmodule(self):
        # copy/paste/modified from original: removed sys.path injection &
        # added Odoo module prefixing so import within modules is correct
        try:
            pypkgpath = self.fspath.pypkgpath()
            pkgroot = pypkgpath.dirpath()
            names = self.fspath.new(ext="").relto(pkgroot).split(self.fspath.sep)
            if names[-1] == "__init__":
                names.pop()
            modname = ".".join(names)
            # for modules in openerp/addons, since there is a __init__ the
            # module name is already fully qualified (maybe?)
            if not modname.startswith('odoo.addons.'):
                modname = 'odoo.addons.' + modname

            __import__(modname)
            mod = sys.modules[modname]
            if self.fspath.basename == "__init__.py":
                # we don't check anything as we might
                # we in a namespace package ... too icky to check
                return mod

            modfile = mod.__file__
            if modfile[-4:] in ('.pyc', '.pyo'):
                modfile = modfile[:-1]
            elif modfile.endswith('$py.class'):
                modfile = modfile[:-9] + '.py'
            if modfile.endswith(os.path.sep + "__init__.py"):
                if self.fspath.basename != "__init__.py":
                    modfile = modfile[:-12]
            try:
                issame = self.fspath.samefile(modfile)
            except py.error.ENOENT:
                issame = False
            if not issame:
                raise self.fspath.ImportMismatchError(modname, modfile, self)
        except SyntaxError:
            raise self.CollectError(
                py.code.ExceptionInfo().getrepr(style="short"))
        except self.fspath.ImportMismatchError:
            e = sys.exc_info()[1]
            raise self.CollectError(
                "import file mismatch:\n"
                "imported module %r has this __file__ attribute:\n"
                "  %s\n"
                "which is not the same as the test file we want to collect:\n"
                "  %s\n"
                "HINT: remove __pycache__ / .pyc files and/or use a "
                "unique basename for your test file modules"
                 % e.args
            )
        #print "imported test module", mod
        self.config.pluginmanager.consider_module(mod)
        return mod

class ModuleTest(object):
    """ Performs filtering for in-module test run:
    * only collects test files contained within the specified module
    * only collects tests enabled for the specified phase
    """
    defaults = {
        'at_install': True,
        'post_install': False
    }
    def __init__(self, phase, modnames):
        self.roots = map(lambda n: py.path.local(module.get_module_path(n)), modnames)
        self.phase = phase

    def pytest_ignore_collect(self, path, config):
        # only allow files from inside the selected module(s)
        return not any(
            root.common(path) == root
            for root in self.roots
        )

    def pytest_collection_modifyitems(self, session, config, items):
        items[:] = filter(self._filter_phase, items)

    def _filter_phase(self, item):
        marker = item.get_marker(self.phase)
        if marker and marker.args:
            return marker.args[0]
        return self.defaults[self.phase]

    @pytest.mark.tryfirst
    def pytest_pycollect_makemodule(self, path, parent):
        """ override collect with own test module thing to alter generated
        module name when tests are found within an Odoo module: rather than
        import ``<module>.foo.bar`` it should be
        ``openerp.addons.<module>.foo.bar``
        """
        # if path to collect is in addons_path, create an OdooTestModule
        if any(root.common(path) == root for root in self.roots):
            return OdooTestModule(path, parent)
        # otherwise create a normal test module
        return None

class DataTests(object):
    def __init__(self, registry, package):
        self.package = package
        self.registry = registry
        self.paths = [
            module.get_resource_path(self.package.name, p)
            for p in self.registry._get_files_of_kind('test', self.package)
        ]
    def pytest_collect_file(self, parent, path):
        if self.paths and path in self.paths:
            d = self.paths
            self.paths = []
            return DataFile(path, parent, self.registry, self.package, d)

class DataFile(pytest.File):
    def __init__(self, path, parent, registry, package, paths):
        super(DataFile, self).__init__(path, parent)
        self.registry = registry
        self.package = package
        self.paths = paths
    def collect(self):
        return [DataItem(self, self.registry, self.package, self.paths)]

class DataException(AssertionError): pass
class DataReporter(assertion_report.assertion_report):
    def record_failure(self):
        raise DataException()

class DataItem(pytest.Item):
    def __init__(self, parent, registry, package, paths):
        super(DataItem, self).__init__(package.name, parent)
        self.package = package
        self.registry = registry
        self.paths = paths

    def runtest(self, report=DataReporter()):
        mode = 'update'
        if hasattr(self.package, 'init') or self.package.state == 'to_install':
            mode = 'init'

        try:
            threading.currentThread().testing = True
            with contextlib.closing(self.registry.cursor()) as cr:
                idrefs = {}
                for p in self.paths:
                    convert_file(cr, self.package.name, p,
                                 idrefs, mode=mode, noupdate=False, kind='test',
                                 report=report, pathname=p)
        finally:
            self.registry.clear_caches()
            threading.currentThread().testing = False

    def reportinfo(self):
        return self.fspath, 0, ""

    def repr_failure(self, exc_info):
        return str(exc_info)


class Registry(collections.Mapping):
    """ Model registry for a particular database.

    The registry is essentially a mapping between model names and model classes.
    There is one registry instance per database.

    """
    _lock = threading.RLock()
    _saved_lock = None

    # a cache for model classes, indexed by their base classes
    model_cache = WeakValueDictionary()

    @lazy_classproperty
    def registries(cls):
        """ A mapping from database names to registries. """
        size = config.get('registry_lru_size', None)
        if not size:
            # Size the LRU depending of the memory limits
            if os.name != 'posix':
                # cannot specify the memory limit soft on windows...
                size = 42
            else:
                # A registry takes 10MB of memory on average, so we reserve
                # 10Mb (registry) + 5Mb (working memory) per registry
                avgsz = 15 * 1024 * 1024
                size = int(config['limit_memory_soft'] / avgsz)
        return lru.LRU(size)

    def __new__(cls, db_name):
        """ Return the registry for the given database name."""
        with cls._lock:
            try:
                return cls.registries[db_name]
            except KeyError:
                return cls.new(db_name)
            finally:
                # set db tracker - cleaned up at the WSGI dispatching phase in
                # odoo.service.wsgi_server.application
                threading.current_thread().dbname = db_name

    @classmethod
    def new(cls, db_name, force_demo=False, status=None, update_module=False):
        """ Create and return a new registry for the given database name. """
        with cls._lock:
            with odoo.api.Environment.manage():
                registry = object.__new__(cls)
                registry.init(db_name)

                # Initializing a registry will call general code which will in
                # turn call Registry() to obtain the registry being initialized.
                # Make it available in the registries dictionary then remove it
                # if an exception is raised.
                cls.delete(db_name)
                cls.registries[db_name] = registry
                try:
                    registry.test_failures = 0
                    registry.setup_signaling()
                    test_args = ['-r', 'fEs', '-s'] + module.ad_paths
                    for event, data in registry.load_modules(force_demo, status, update_module):
                        # launch tests only in demo mode, allowing tests to use demo data.
                        if event == 'module_processed':
                            if not config['test_enable']:
                                continue
                            if not (hasattr(data, 'demo') or (data.dbdemo and data.state != 'installed')):
                                continue

                            # closing will rollback & close instead of commit & close
                            with contextlib.closing(registry.cursor()) as cr:
                                env = api.Environment(cr, SUPERUSER_ID, {})
                                # Python tests
                                env['ir.http']._clear_routing_map()     # force routing map to be rebuilt

                        # magically defines current module as installed for
                        # purpose of routing map generation, maybe test should
                        # run after that's been done but before thingy has
                        # been thingied
                        module.current_test = data.name
                        threading.currentThread().testing = True

                        retcode = pytest.main(test_args, plugins=[
                            ModuleTest('at_install', [data.name]),
                            DataTests(registry, data)
                        ])
                        if retcode in FAILURES:
                            registry.test_failures += 1

                        threading.currentThread().testing = False
                        module.current_test = None

                except Exception:
                    _logger.exception('Failed to load registry')
                    del cls.registries[db_name]
                    raise

                # load_modules() above can replace the registry by calling
                # indirectly new() again (when modules have to be uninstalled).
                # Yeah, crazy.
                init_parent = registry._init_parent
                registry = cls.registries[db_name]
                registry._init_parent.update(init_parent)

                with contextlib.closing(registry.cursor()) as cr:
                    registry.do_parent_store(cr)
                    cr.commit()

        registry.ready = True
        registry._init = False
        registry.registry_invalidated = bool(update_module)

        return registry

    def init(self, db_name):
        self.models = {}    # model name/model instance mapping
        self._sql_error = {}
        self._init = True
        self._init_parent = {}
        self._assertion_report = assertion_report.assertion_report()
        self._fields_by_model = None
        self._post_init_queue = collections.deque()

        self.graph = graph.Graph()

        # modules fully loaded (maintained during init phase by `loading` module)
        self._init_modules = set()
        self.updated_modules = []       # installed/updated modules

        self.db_name = db_name
        self._db = odoo.sql_db.db_connect(db_name)

        # special cursor for test mode; None means "normal" mode
        self.test_cr = None

        # Indicates that the registry is
        self.loaded = False             # whether all modules are loaded
        self.ready = False              # whether everything is set up

        # Inter-process signaling (used only when odoo.multi_process is True):
        # The `base_registry_signaling` sequence indicates the whole registry
        # must be reloaded.
        # The `base_cache_signaling sequence` indicates all caches must be
        # invalidated (i.e. cleared).
        self.registry_sequence = None
        self.cache_sequence = None

        # Flags indicating invalidation of the registry or the cache.
        self.registry_invalidated = False
        self.cache_invalidated = False

        with contextlib.closing(self.cursor()) as cr:
            has_unaccent = db.has_unaccent(cr)
            if odoo.tools.config['unaccent'] and not has_unaccent:
                _logger.warning("The option --unaccent was given but no unaccent() function was found in database.")
            self.has_unaccent = odoo.tools.config['unaccent'] and has_unaccent

    @classmethod
    def delete(cls, db_name):
        """ Delete the registry linked to a given database. """
        with cls._lock:
            if db_name in cls.registries:
                registry = cls.registries.pop(db_name)
                registry.clear_caches()
                registry.registry_invalidated = True

    @classmethod
    def delete_all(cls):
        """ Delete all the registries. """
        with cls._lock:
            for db_name in list(pycompat.keys(cls.registries)):
                cls.delete(db_name)

    #
    # Mapping abstract methods implementation
    # => mixin provides methods keys, items, values, get, __eq__, and __ne__
    #
    def __len__(self):
        """ Return the size of the registry. """
        return len(self.models)

    def __iter__(self):
        """ Return an iterator over all model names. """
        return iter(self.models)

    def __getitem__(self, model_name):
        """ Return the model with the given name or raise KeyError if it doesn't exist."""
        return self.models[model_name]

    def __call__(self, model_name):
        """ Same as ``self[model_name]``. """
        return self.models[model_name]

    def __setitem__(self, model_name, model):
        """ Add or replace a model in the registry."""
        self.models[model_name] = model

    @lazy_property
    def field_sequence(self):
        """ Return a function mapping a field to an integer. The value of a
            field is guaranteed to be strictly greater than the value of the
            field's dependencies.
        """
        # map fields on their dependents
        dependents = {
            field: set(dep for dep, _ in model._field_triggers[field] if dep != field)
            for model in pycompat.values(self)
            for field in pycompat.values(model._fields)
        }
        # sort them topologically, and associate a sequence number to each field
        mapping = {
            field: num
            for num, field in enumerate(reversed(topological_sort(dependents)))
        }
        return mapping.get

    def do_parent_store(self, cr):
        env = odoo.api.Environment(cr, SUPERUSER_ID, {})
        for model_name in self._init_parent:
            if model_name in env:
                env[model_name]._parent_store_compute()

    def descendants(self, model_names, *kinds):
        """ Return the models corresponding to ``model_names`` and all those
        that inherit/inherits from them.
        """
        assert all(kind in ('_inherit', '_inherits') for kind in kinds)
        funcs = [attrgetter(kind + '_children') for kind in kinds]

        models = OrderedSet()
        queue = collections.deque(model_names)
        while queue:
            model = self[queue.popleft()]
            models.add(model._name)
            for func in funcs:
                queue.extend(func(model))
        return models

    def load(self, cr, package):
        """ Load a given module in the registry, and return the names of the
        modified models.

        At the Python level, the modules are already loaded, but not yet on a
        per-registry level. This method populates a registry with the given
        modules, i.e. it instanciates all the classes of a the given module
        and registers them in the registry.

        :type package: graph.Node
        """
        from .. import models

        lazy_property.reset_all(self)

        # Instantiate registered classes (via the MetaModel automatic discovery
        # or via explicit constructor call), and add them to the pool.
        model_names = []
        for cls in models.MetaModel.module_to_models.get(package.name, []):
            # models register themselves in self.models
            model = cls._build_model(self, cr)
            model_names.append(model._name)

        return self.descendants(model_names, '_inherit', '_inherits')

    def setup_models(self, cr):
        """ Complete the setup of models.
            This must be called after loading modules and before using the ORM.
        """
        lazy_property.reset_all(self)
        env = odoo.api.Environment(cr, SUPERUSER_ID, {})

        # add manual models
        if self._init_modules:
            env['ir.model']._add_manual_models()

        # prepare the setup on all models
        models = list(pycompat.values(env))
        for model in models:
            model._prepare_setup()

        # do the actual setup from a clean state
        self._m2m = {}
        for model in models:
            model._setup_base()

        for model in models:
            model._setup_fields()

        for model in models:
            model._setup_complete()

        self.registry_invalidated = True

    def post_init(self, func, *args, **kwargs):
        """ Register a function to call at the end of :meth:`~.init_models`. """
        self._post_init_queue.append(partial(func, *args, **kwargs))

    def init_models(self, cr, model_names, context):
        """ Initialize a list of models (given by their name). Call methods
            ``_auto_init`` and ``init`` on each model to create or update the
            database tables supporting the models.

            The ``context`` may contain the following items:
             - ``module``: the name of the module being installed/updated, if any;
             - ``update_custom_fields``: whether custom fields should be updated.
        """
        if 'module' in context:
            _logger.info('module %s: creating or updating database tables', context['module'])

        env = odoo.api.Environment(cr, SUPERUSER_ID, context)
        models = [env[model_name] for model_name in model_names]

        for model in models:
            model._auto_init()
            model.init()

        while self._post_init_queue:
            func = self._post_init_queue.popleft()
            func()

        if models:
            models[0].recompute()

        # make sure all tables are present
        table2model = {model._table: name for name, model in env.items() if not model._abstract}
        missing_tables = set(table2model).difference(existing_tables(cr, table2model))
        if missing_tables:
            missing = {table2model[table] for table in missing_tables}
            _logger.warning("Models have no table: %s.", ", ".join(missing))
            # recreate missing tables following model dependencies
            deps = {name: model._depends for name, model in pycompat.items(env)}
            for name in topological_sort(deps):
                if name in missing:
                    _logger.info("Recreate table of model %s.", name)
                    env[name].init()
            # check again, and log errors if tables are still missing
            missing_tables = set(table2model).difference(existing_tables(cr, table2model))
            for table in missing_tables:
                _logger.error("Model %s has no table.", table2model[table])

    @lazy_property
    def cache(self):
        """ A cache for model methods. """
        # this lazy_property is automatically reset by lazy_property.reset_all()
        return lru.LRU(8192)

    def _clear_cache(self):
        """ Clear the cache and mark it as invalidated. """
        self.cache.clear()
        self.cache_invalidated = True

    def clear_caches(self):
        """ Clear the caches associated to methods decorated with
        ``tools.ormcache`` or ``tools.ormcache_multi`` for all the models.
        """
        for model in pycompat.values(self.models):
            model.clear_caches()

    def setup_signaling(self):
        """ Setup the inter-process signaling on this registry. """
        if not odoo.multi_process:
            return

        with self.cursor() as cr:
            # The `base_registry_signaling` sequence indicates when the registry
            # must be reloaded.
            # The `base_cache_signaling` sequence indicates when all caches must
            # be invalidated (i.e. cleared).
            cr.execute("SELECT sequence_name FROM information_schema.sequences WHERE sequence_name='base_registry_signaling'")
            if not cr.fetchall():
                cr.execute("CREATE SEQUENCE base_registry_signaling INCREMENT BY 1 START WITH 1")
                cr.execute("SELECT nextval('base_registry_signaling')")
                cr.execute("CREATE SEQUENCE base_cache_signaling INCREMENT BY 1 START WITH 1")
                cr.execute("SELECT nextval('base_cache_signaling')")

            cr.execute(""" SELECT base_registry_signaling.last_value,
                                  base_cache_signaling.last_value
                           FROM base_registry_signaling, base_cache_signaling""")
            self.registry_sequence, self.cache_sequence = cr.fetchone()
            _logger.debug("Multiprocess load registry signaling: [Registry: %s] [Cache: %s]",
                          self.registry_sequence, self.cache_sequence)

    def check_signaling(self):
        """ Check whether the registry has changed, and performs all necessary
        operations to update the registry. Return an up-to-date registry.
        """
        if not odoo.multi_process:
            return self

        with contextlib.closing(self.cursor()) as cr:
            cr.execute(""" SELECT base_registry_signaling.last_value,
                                  base_cache_signaling.last_value
                           FROM base_registry_signaling, base_cache_signaling""")
            r, c = cr.fetchone()
            _logger.debug("Multiprocess signaling check: [Registry - %s -> %s] [Cache - %s -> %s]",
                          self.registry_sequence, r, self.cache_sequence, c)
            # Check if the model registry must be reloaded
            if self.registry_sequence != r:
                _logger.info("Reloading the model registry after database signaling.")
                self = Registry.new(self.db_name)
            # Check if the model caches must be invalidated.
            elif self.cache_sequence != c:
                _logger.info("Invalidating all model caches after database signaling.")
                self.clear_caches()
                self.cache_invalidated = False
            self.registry_sequence = r
            self.cache_sequence = c

        return self

    def signal_changes(self):
        """ Notifies other processes if registry or cache has been invalidated. """
        if odoo.multi_process and self.registry_invalidated:
            _logger.info("Registry changed, signaling through the database")
            with contextlib.closing(self.cursor()) as cr:
                cr.execute("select nextval('base_registry_signaling')")
                self.registry_sequence = cr.fetchone()[0]

        # no need to notify cache invalidation in case of registry invalidation,
        # because reloading the registry implies starting with an empty cache
        elif odoo.multi_process and self.cache_invalidated:
            _logger.info("At least one model cache has been invalidated, signaling through the database.")
            with contextlib.closing(self.cursor()) as cr:
                cr.execute("select nextval('base_cache_signaling')")
                self.cache_sequence = cr.fetchone()[0]

        self.registry_invalidated = False
        self.cache_invalidated = False

    def reset_changes(self):
        """ Reset the registry and cancel all invalidations. """
        if self.registry_invalidated:
            with closing(self.cursor()) as cr:
                self.setup_models(cr)
                self.registry_invalidated = False
        if self.cache_invalidated:
            self.cache.clear()
            self.cache_invalidated = False

    @contextlib.contextmanager
    def manage_changes(self):
        """ Context manager to signal/discard registry and cache invalidations. """
        try:
            yield self
            self.signal_changes()
        except Exception:
            self.reset_changes()
            raise

    def in_test_mode(self):
        """ Test whether the registry is in 'test' mode. """
        return self.test_cr is not None

    def enter_test_mode(self):
        """ Enter the 'test' mode, where one cursor serves several requests. """
        assert self.test_cr is None
        self.test_cr = self._db.test_cursor()
        assert Registry._saved_lock is None
        Registry._saved_lock = Registry._lock
        Registry._lock = DummyRLock()

    def leave_test_mode(self):
        """ Leave the test mode. """
        assert self.test_cr is not None
        self.clear_caches()
        self.test_cr.force_close()
        self.test_cr = None
        assert Registry._saved_lock is not None
        Registry._lock = Registry._saved_lock
        Registry._saved_lock = None

    def cursor(self):
        """ Return a new cursor for the database. The cursor itself may be used
            as a context manager to commit/rollback and close automatically.
        """
        cr = self.test_cr
        if cr is not None:
            # While in test mode, we use one special cursor across requests. The
            # test cursor uses a reentrant lock to serialize accesses. The lock
            # is granted here by cursor(), and automatically released by the
            # cursor itself in its method close().
            cr.acquire()
            return cr
        return self._db.cursor()

    def load_modules(self, force_demo=False, status=None, update_module=False):
        module.initialize_sys_path()

        force = []
        if force_demo:
            force.append('demo')

        with self.cursor() as cr:
            if not db.is_initialized(cr):
                _logger.info("init db")
                db.initialize(cr)
                update_module = True    # process auto-installed modules
                config["init"]["all"] = 1
                config['update']['all'] = 1
                if not config['without_demo']:
                    config["demo"]['all'] = 1

            env = api.Environment(cr, SUPERUSER_ID, {})

            if 'base' in config['update'] or 'all' in config['update']:
                cr.execute("update ir_module_module set state=%s where name=%s and state=%s", ('to upgrade', 'base', 'installed'))

            # STEP 1: LOAD BASE (must be done before module dependencies can be computed for later steps)
            self.graph.add_module(cr, 'base', force)
            if not self.graph:
                _logger.critical('module base cannot be loaded! (hint: verify addons-path)')
                raise ImportError('Module `base` cannot be loaded! (hint: verify addons-path)')

            # avoid double loading as load_module_graph is called multiple times
            loaded_modules = set()
            # modules which may need cleanup step
            processed_modules = []
            for event, data in self.load_module_graph(cr, perform_checks=update_module):
                if event == 'module_loaded':
                    loaded_modules.add(data.name)
                elif event == 'module_processed':
                    processed_modules.append(data.name)
                yield event, data

            load_lang = config.pop('load_language')
            if load_lang or update_module:
                # some base models are used below, so make sure they are set up
                self.setup_models(cr)

            if load_lang:
                for lang in load_lang.split(','):
                    self.load_language(cr, lang)

            # STEP 2: Mark other modules to be loaded/updated
            if update_module:
                Module = env['ir.module.module']
                if ('base' in config['init']) or ('base' in config['update']):
                    _logger.info('updating modules list')
                    Module.update_list()

                self._check_module_names(cr, itertools.chain(config['init'].keys(), config['update'].keys()))

                module_names = [k for k, v in config['init'].items() if v]
                if module_names:
                    modules = Module.search([('state', '=', 'uninstalled'), ('name', 'in', module_names)])
                    if modules:
                        modules.button_install()

                module_names = [k for k, v in config['update'].items() if v]
                if module_names:
                    modules = Module.search([('state', '=', 'installed'), ('name', 'in', module_names)])
                    if modules:
                        modules.button_upgrade()

                cr.execute("update ir_module_module set state=%s where name=%s", ('installed', 'base'))
                Module.invalidate_cache(['state'])

            # STEP 3: Load marked modules (skipping base which was done in STEP 1)
            # IMPORTANT: this is done in two parts, first loading all installed or
            #            partially installed modules (i.e. installed/to upgrade), to
            #            offer a consistent system to the second part: installing
            #            newly selected modules.
            #            We include the modules 'to remove' in the first step, because
            #            they are part of the "currently installed" modules. They will
            #            be dropped in STEP 6 later, before restarting the loading
            #            process.
            # IMPORTANT 2: We have to loop here until all relevant modules have been
            #              processed, because in some rare cases the dependencies have
            #              changed, and modules that depend on an uninstalled module
            #              will not be processed on the first pass.
            #              It's especially useful for migrations.
            previously_processed = -1
            while previously_processed < len(processed_modules):
                previously_processed = len(processed_modules)
                for event, data in self.load_marked_modules(cr, ['installed', 'to upgrade', 'to remove'], force, loaded_modules, update_module):
                    if event == 'module_loaded':
                        loaded_modules.add(data.name)
                    elif event == 'module_processed':
                        processed_modules.append(data.name)
                    yield event, data

                if update_module:
                    for event, data in self.load_marked_modules(cr, ['to install'], force, loaded_modules, update_module):
                        if event == 'module_loaded':
                            loaded_modules.add(data.name)
                        elif event == 'module_processed':
                            processed_modules.append(data.name)
                        yield event, data

            self.loaded = True
            self.setup_models(cr)

            # STEP 3.5: execute migration end-scripts
            migrations = migration.MigrationManager(cr, self.graph)
            for package in self.graph:
                migrations.migrate_module(package, 'end')

            # STEP 4: Finish and cleanup installations
            if processed_modules:
                cr.execute("""select model,name from ir_model where id NOT IN (select distinct model_id from ir_model_access)""")
                for (model, name) in cr.fetchall():
                    m = self.get(model)
                    if m and not m._abstract and not m._transient:
                        _logger.warning('The model %s has no access rules, consider adding one. E.g. access_%s,access_%s,model_%s,,1,0,0,0',
                                        model, model.replace('.', '_'), model.replace('.', '_'), model.replace('.', '_'))

                # Temporary warning while we remove access rights on osv_memory objects, as they have
                # been replaced by owner-only access rights
                cr.execute("""select distinct mod.model, mod.name from ir_model_access acc, ir_model mod where acc.model_id = mod.id""")
                for (model, name) in cr.fetchall():
                    if model in self and self[model]._transient:
                        _logger.warning('The transient model %s (%s) should not have explicit access rules!', model, name)

                cr.execute("SELECT model from ir_model")
                for (model,) in cr.fetchall():
                    if model in self:
                        env[model]._check_removed_columns(log=True)
                    elif _logger.isEnabledFor(logging.INFO):    # more an info that a warning...
                        _logger.warning("Model %s is declared but cannot be loaded! (Perhaps a module was partially removed or renamed)", model)

                # Cleanup orphan records
                env['ir.model.data']._process_end(processed_modules)

            for kind in ('init', 'demo', 'update'):
                config[kind] = {}

            cr.commit()

            # STEP 5: Uninstall modules to remove
            if update_module:
                # Remove records referenced from ir_model_data for modules to be
                # removed (and removed the references from ir_model_data).
                cr.execute("SELECT name, id FROM ir_module_module WHERE state=%s", ('to remove',))
                modules_to_remove = dict(cr.fetchall())
                if modules_to_remove:
                    pkgs = reversed([p for p in self.graph if p.name in modules_to_remove])
                    for pkg in pkgs:
                        uninstall_hook = pkg.info.get('uninstall_hook')
                        if uninstall_hook:
                            py_module = sys.modules['odoo.addons.%s' % (pkg.name,)]
                            getattr(py_module, uninstall_hook)(cr, self)

                    Module = env['ir.module.module']
                    Module.browse(pycompat.values(modules_to_remove)).module_uninstall()
                    # Recursive reload, should only happen once, because there should be no
                    # modules to remove next time
                    cr.commit()
                    _logger.info('Reloading registry once more after uninstalling modules')
                    api.Environment.reset()
                    self.new(cr.dbname, force_demo=force_demo, update_module=update_module)
                    return

            # STEP 6: verify custom views on every model
            if update_module:
                View = env['ir.ui.view']
                for model in self:
                    try:
                        View._validate_custom_views(model)
                    except Exception as e:
                        _logger.warning('invalid custom view(s) for model %s: %s', model, ustr(e))

            # STEP 8: call _register_hook on every model
            for model in pycompat.values(env):
                model._register_hook()

            # STEP 9: save installed/updated modules for post-install tests
            self.updated_modules += processed_modules
            cr.commit()
    def load_marked_modules(self, cr, states, force, loaded_modules, perform_checks):
        """Loads modules marked with ``states``, adding them to ``graph`` and
           ``loaded_modules`` and returns a list of installed/upgraded modules."""
        # loop until there's no module left to process
        processed_any = True
        loaded = set(loaded_modules)
        while processed_any:
            cr.execute("SELECT name from ir_module_module WHERE state IN %s", (tuple(states),))
            module_list = [name for (name,) in cr.fetchall() if name not in self.graph]
            if not module_list:
                break

            self.graph.add_modules(cr, module_list, force)
            _logger.debug('Updating graph with %d more modules', len(module_list))

            processed_any = False
            for event, data in self.load_module_graph(cr, skip_modules=loaded_modules, perform_checks=perform_checks):
                if event == 'module_loaded':
                    loaded.add(data.name)
                elif event == 'module_processed':
                    processed_any = True
                yield event, data

    def _load_test(self, cr, package, idref, mode):
        try:
            self._load_data(cr, package, idref, mode=mode, kind='test')
            return True
        except Exception:
            _test_logger.exception(
                'module %s: an exception occurred in a test', package.name)
            return False
        finally:
            # avoid keeping stale xml_id, etc. in cache
            self.clear_caches()

    def _get_files_of_kind(self, kind, package):
        if kind == 'demo':
            kind = ['demo_xml', 'demo']
        elif kind == 'data':
            kind = ['init_xml', 'update_xml', 'data']
        if isinstance(kind, str):
            kind = [kind]
        files = []
        for k in kind:
            for f in package.data[k]:
                files.append(f)
                if not k.endswith('_xml'):
                    continue

                if k == 'init_xml' and not f.endswith('.xml'):
                    continue

                # init_xml, update_xml and demo_xml are deprecated except
                # for the case of init_xml with yaml, csv and sql files as
                # we can't specify noupdate for those file.
                correct_key = 'demo' if 'demo' in k else 'data'
                _logger.warning(
                    "module %s: key '%s' is deprecated in favor of '%s' for file '%s'.",
                    package.name, k, correct_key, f
                )
        return files

    def _load_data(self, cr, package, idref, mode, kind):
        """

        kind: data, demo, test, init_xml, update_xml, demo_xml.

        noupdate is False, unless it is demo data or it is csv data in
        init mode.
        """
        if kind in ('demo', 'test'):
            threading.currentThread().testing = True
        try:
            for filename in self._get_files_of_kind(kind, package):
                _logger.info("loading %s/%s", package.name, filename)
                noupdate = False
                if kind in ('demo', 'demo_xml') or (filename.endswith('.csv') and kind in ('init', 'init_xml')):
                    noupdate = True
                convert_file(cr, package.name, filename, idref, mode, noupdate, kind, self._assertion_report)
        finally:
            if kind in ('demo', 'test'):
                threading.currentThread().testing = False

    def load_module_graph(self, cr, perform_checks=True, skip_modules=None):
        """Migrates+Updates or Installs all module nodes from ``graph``
           :param perform_checks: whether module descriptors should be checked for validity (prints warnings
                                  for same cases)
           :param skip_modules: optional list of module names (packages) which have previously been loaded and can be skipped
           :return: list of modules that were installed or updated
        """
        migrations = migration.MigrationManager(cr, self.graph)
        module_count = len(self.graph)
        _logger.info('loading %d modules...', module_count)

        self.clear_caches()

        # register, instantiate and initialize models for each modules
        t0 = time.time()
        t0_sql = odoo.sql_db.sql_counter

        for index, package in enumerate(self.graph, 1):
            assert isinstance(package, graph.Node)
            if skip_modules and package.name in skip_modules:
                continue

            _logger.debug('loading module %s (%d/%d)', package.name, index, module_count)
            migrations.migrate_module(package, 'pre')
            module.load_openerp_module(package.name)

            new_install = package.state == 'to install'
            if new_install:
                py_module = sys.modules['odoo.addons.%s' % (package.name,)]
                pre_init = package.info.get('pre_init_hook')
                if pre_init:
                    getattr(py_module, pre_init)(cr)

            model_names = self.load(cr, package)

            idref = {}

            mode = 'update'
            if hasattr(package, 'init') or package.state == 'to install':
                mode = 'init'

            # models loaded in python (ish), why not setup_models?
            yield "module_loaded", package
            if hasattr(package, 'init') or hasattr(package, 'update') or package.state in ('to install', 'to upgrade'):
                env = api.Environment(cr, SUPERUSER_ID, {})
                self.setup_models(cr)
                # db alterations + possible DB hooks (init)
                self.init_models(cr, model_names, {'module': package.name})
                cr.commit()
                modrec = env['ir.module.module'].browse(package.id)

                if perform_checks:
                    modrec.check()

                if package.state == 'to upgrade':
                    # upgrading the module information
                    modrec.write(modrec.get_values_from_terp(package.data))
                self._load_data(cr, package, idref, mode, kind='data')
                has_demo = hasattr(package, 'demo') or (package.dbdemo and package.state != 'installed')
                if has_demo:
                    self._load_data(cr, package, idref, mode, kind='demo')
                    modrec.write({'demo': True})

                migrations.migrate_module(package, 'post')

                # Update translations for all installed languages
                overwrite = odoo.tools.config["overwrite_existing_translations"]
                modrec.with_context(overwrite=overwrite).update_translations()

                self._init_modules.add(package.name)

                if new_install:
                    post_init = package.info.get('post_init_hook')
                    if post_init:
                        getattr(py_module, post_init)(cr, self)

                # validate all the views at a whole
                env['ir.ui.view']._validate_module_views(package.name)

                # necessary to make everything visible to module
                # post-processing (e.g. tests) which use different cursors
                cr.commit()
                yield "module_processed", package

                ver = module.adapt_version(package.data['version'])
                # Set new modules and dependencies
                modrec.write({'state': 'installed', 'latest_version': ver})

                package.load_state = package.state
                package.load_version = package.installed_version
                package.state = 'installed'
                for kind in ('init', 'demo', 'update'):
                    if hasattr(package, kind):
                        delattr(package, kind)

            self._init_modules.add(package.name)
            cr.commit()

        _logger.log(25, "%s modules loaded in %.2fs, %s queries", len(self.graph), time.time() - t0, odoo.sql_db.sql_counter - t0_sql)

        self.clear_caches()

        cr.commit()

    def _check_module_names(self, cr, module_names):
        mod_names = set(module_names)
        # ignore dummy 'all' module
        if 'base' in mod_names and 'all' in mod_names:
            mod_names.remove('all')
        if mod_names:
            cr.execute("SELECT count(id) AS count FROM ir_module_module WHERE name in %s", (tuple(mod_names),))
            if cr.dictfetchone()['count'] != len(mod_names):
                # find out what module name(s) are incorrect:
                cr.execute("SELECT name FROM ir_module_module")
                incorrect_names = mod_names.difference([x['name'] for x in cr.dictfetchall()])
                _logger.warning('invalid module names, ignored: %s', ", ".join(incorrect_names))

    def load_language(self, cr, lang):
        """Loads a translation terms for a language.

        Used mainly to automate language loading at db initialization.

        :param str lang: language ISO code with optional _underscore_ and l10n
                         flavor (ex: 'fr', 'fr_BE', but not 'fr-BE')
        """
        env = odoo.api.Environment(cr, SUPERUSER_ID, {})
        installer = env['base.language.install'].create({'lang': lang})
        installer.lang_install()


class DummyRLock(object):
    """ Dummy reentrant lock, to be used while running rpc and js tests """
    def acquire(self):
        pass
    def release(self):
        pass
    def __enter__(self):
        self.acquire()
    def __exit__(self, type, value, traceback):
        self.release()
