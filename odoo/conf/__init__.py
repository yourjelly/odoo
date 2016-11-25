# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
"""
Odoo settings
"""
from __future__ import absolute_import, division, print_function

import ConfigParser
import optparse
import os
import sys
from os.path import join as opj

import odoo
import odoo.loglevels as loglevels
import odoo.release as release

from . import deprecation  # noqa
from . import appdirs  # noqa


# Paths to search for OpenERP addons.
addons_paths = []

# List of server-wide modules to load. Those modules are supposed to provide
# features not necessarily tied to a particular database. This is in contrast
# to modules that are always bound to a specific database when they are
# installed (i.e. the majority of OpenERP addons). This is set with the --load
# command-line option.
server_wide_modules = []


def _get_default_datadir():
    home = os.path.expanduser('~')
    if os.path.isdir(home):
        func = appdirs.user_data_dir
    else:
        if sys.platform in ['win32', 'darwin']:
            func = appdirs.site_data_dir
        else:
            func = lambda **kwarg: "/var/lib/%s" % kwarg['appname'].lower()  # noqa
    # No "version" kwarg as session and filestore paths are shared against series
    return func(appname=release.product_name, appauthor=release.author)


class Settings(object):
    """
    Odoo Settings
    """
    root_path = os.path.abspath(os.path.expanduser(os.path.expandvars(opj(os.path.dirname(__file__), '..'))))

    # TODO: properly implement dict
    def __init__(self):
        # The defaults settings (will be updated by odoo.cli.init_settings)
        self.defaults = {
            'addons_path': self.get_default_addons_path(),
            'publisher_warranty_url': 'http://services.openerp.com/publisher-warranty/',
            'reportgz': False,
            'root_path': self.root_path,
            'demo': {},

            # TODO: So, ... should I have all defaults here ? I think so.
            'config': None,
        }

        # Cli options instances
        self._options = {}

        # Values loaded from the configuration files
        self.rc_values = {}

        # List of configuration files Odoo will parse for options
        self.user_rc_file = appdirs.user_config_dir(opj('odoo', 'odoo.conf'))
        self.loaded_files = set()

        # Values defined through the command line interface
        self.cli = {}

        # Values manually assigned at runtime
        self.runtime = {}

        # Order used for the dictionary lookup. First item found is returned.
        self.order = [self.runtime, self.cli, self.rc_values, self.defaults]

        self.rc_files = self.get_rc_files()
        self.load_rc_files()

    def __contains__(self, key):
        return key in self.keys()

    def __iter__(self):
        for key in self.keys():
            yield key

    def __getitem__(self, key):
        # Some special cases
        if key == 'demo' and not self['without_demo']:
            # TODO: restored old behaviour but does not honor the doc
            demo = dict(self.defaults['demo'])
            demo.update(self['init'])
            return demo
        if 'xmlrpc' in key:
            # Legacy options
            return self[key.replace('xmlrpc', 'http')]

        last_src = self.order[-1]
        for dic in self.order:
            if key in dic:
                value = dic.get(key)
                if value is None and dic is not last_src and key in last_src:
                    # `None` value means we will traverse the sources. The new
                    # configuration file handling will not write `None` values,
                    # but we want to avoid old configuration files to trigger
                    # this kind of issues:
                    # - https://github.com/odoo/odoo/issues/14048
                    # - https://github.com/odoo/odoo/issues/14045
                    continue
                return self.sanitize(key, value)

        raise KeyError(key)

    def __setitem__(self, name, value):
        self.runtime[name] = self.sanitize(name, value)

    def to_dict(self):
        return dict((key, self[key]) for key in self.keys())

    def init_options(self, options):
        for option in options:
            name = option.dest
            if name not in self._options:
                self._options[name] = option
                if name not in self:
                    self.defaults[name] = self.sanitize(name, option.my_default)

    def sanitize(self, name, value):
        """
        Sanitize an option value according to it's type definition.
        The check is only done if the value is a string.
        """
        option = self._options.get(name)
        if option and isinstance(value, basestring):
            if option.action == 'append':
                value = value.split(',')
            elif option.type in optparse.Option.TYPE_CHECKER:
                try:
                    value = optparse.Option.TYPE_CHECKER[option.type](option, name, value)
                except optparse.OptionValueError as opterror:
                    # In the cli options, we allow to define a default value with a different
                    # type than the specified type. We must prevent config file to interfer this rule.
                    #   eg: `db_port` defaults to `False` but if used in cli, it hould be an integer
                    if option.my_default is None and value.lower() == 'none':
                        value = None
                    elif isinstance(option.my_default, bool):
                        value = (value in ('True', 'true'))
                    else:
                        deftype = type(option.my_default)
                        try:
                            value = deftype(value)
                        except ValueError:
                            # If none of the previous fallback matches then we
                            # consider it's a real sanitization error
                            if not option.sanitize:
                                raise opterror
            elif option.type == 'bool':
                value = (value in ('True', 'true'))
            elif str(option.my_default) == value:
                value = option.my_default
            elif value == 'None':
                # TODO: really ? what if database name is None ?
                from pudb import set_trace; set_trace()  # *** Breakpoint ***
                value = None
        if option and option.sanitize:
            value = option.sanitize(value)
        return value

    def keys(self):
        keys = set()
        keys.update(*[dic.keys() for dic in self.order])
        return list(keys)

    # def root_path(self, *args):
    #     # TODO
    #     pass

    def set_addons_path(self, addons_path):
        from pudb import set_trace; set_trace()  # *** Breakpoint ***
        self['addons_path'] = ",".join(
            os.path.abspath(os.path.expanduser(os.path.expandvars(path.strip())))
            for path in addons_path.split(',')
        )

    def get_default_addons_path(self):
        addons = []
        base_addons = opj(self.root_path, 'addons')
        if os.path.exists(base_addons):
            addons.append(base_addons)
        main_addons = os.path.abspath(opj(self.root_path, '../addons'))
        if os.path.exists(main_addons):
            addons.append(main_addons)
        return ','.join(addons)

    def get_rc_files(self):
        files = [
            appdirs.site_config_dir(opj('odoo', 'odoo.conf')),
        ]
        if os.name == 'nt':
            # search the config file on Win32 near the server installation
            # if the server is run by an unprivileged user, he has to specify the location of a configuration file
            # where he has the rights to write, otherwise he won't be able to save the configurations, or even to
            # start the server...
            win_path = opj(os.path.abspath(os.path.dirname(sys.argv[0])), 'odoo.conf')
            files.append(win_path)
        else:
            files.extend([
                # legacy configuration files
                os.path.expanduser('~/.openerp_serverrc'),
                os.path.expanduser('~/.odoorc'),
            ])

        files.append(self.user_rc_file)

        # current working directory config (handy for development)
        files.append('.odoorc')
        env_file = os.getenv('ODOO_RC')
        if env_file:
            files.append(env_file)

        if self['config']:
            files.append(self['config'])

        return files

    def load_rc_files(self, *other_files):
        files = set(self.rc_files + list(other_files))
        parser = ConfigParser.ConfigParser()
        for rc_file in files:
            try:
                parser.read(rc_file)
                for name, value in parser.items('options'):
                    # TODO: check if sanitization failed and warn user about variable name + file the error lays
                    self.rc_values[name] = self.sanitize(name, value)
                if os.path.isfile(rc_file):
                    self.loaded_files.add(rc_file)
                # TODO: parse the other sections, as well
                # for sec in p.sections():
            except IOError:
                pass
            except ConfigParser.NoSectionError:
                pass

    def _parse_config_old(self, args=None):
        if args is None:
            args = []
        opt, args = self.parser.parse_args([])

        for name, option in self.casts.items():
            # Copy the command-line argument
            cli_value = getattr(opt, name, None)

            if cli_value and not option.disabled and option.cli:
                if 'append' in option.action:
                    # we take care of action=append cli options here by extending the config file values
                    self.options[name].extend(cli_value)
                else:
                    self.options[name] = cli_value
            elif option.disabled:
                # Always fill disabled option values with None
                self.options[name] = None

            type_checker = optparse.Option.TYPE_CHECKER.get(option.type)
            if isinstance(self.options[name], basestring) and type_checker:
                self.options[name] = type_checker(option, name, self.options[name])

        self.options['init'] = opt.init and dict.fromkeys(opt.init.split(','), 1) or {}
        self.options['demo'] = (self.options['init']
                                if not self.options['without_demo'] else {})
        self.options['update'] = opt.update and dict.fromkeys(opt.update.split(','), 1) or {}
        self.options['translate_modules'] = opt.translate_modules and map(lambda m: m.strip(), opt.translate_modules.split(',')) or ['all']
        self.options['translate_modules'].sort()

        dev_split = opt.dev_mode and  map(str.strip, opt.dev_mode.split(',')) or []
        self.options['dev_mode'] = 'all' in dev_split and dev_split + ['pdb', 'reload', 'qweb', 'werkzeug', 'xml'] or dev_split

        if opt.pg_path:
            self.options['pg_path'] = opt.pg_path

        if self.options.get('language', False):
            if len(self.options['language']) > 5:
                raise Exception('ERROR: The Lang name must take max 5 chars, Eg: -lfr_BE')

        if opt.save:
            self.save()

        global addons_paths
        addons_paths = self.options['addons_path'].split(',')
        if opt.server_wide_modules:
            odoo.conf.server_wide_modules = map(lambda m: m.strip(), opt.server_wide_modules.split(','))
        else:
            odoo.conf.server_wide_modules = ['web','web_kanban']

    def save_old(self):
        self._LOGLEVELS = dict([
            (getattr(loglevels, 'LOG_%s' % x), getattr(logging, x))
            for x in ('CRITICAL', 'ERROR', 'WARNING', 'INFO', 'DEBUG', 'NOTSET')
        ])
        p = ConfigParser.ConfigParser()
        loglevelnames = dict(zip(self._LOGLEVELS.values(), self._LOGLEVELS.keys()))
        p.add_section('options')
        for opt in sorted(self.options.keys()):
            option = self.casts.get(opt)
            if not option:
                # We ignore non option config keys such as 'demo', they should not be stored in the
                # configuration file as they are generated for runtime usage only
                continue
            if not option.save or (option.group and not option.group.save):
                # We do not save options with save=False or option's group whose save=False
                continue
            if opt in ('log_level',):
                p.set('options', opt, loglevelnames.get(self.options[opt], self.options[opt]))
            elif opt == 'log_handler':
                p.set('options', opt, ','.join(_deduplicate_loggers(self.options[opt])))
            else:
                p.set('options', opt, self.options[opt])

        for sec in sorted(self.misc.keys()):
            p.add_section(sec)
            for opt in sorted(self.misc[sec].keys()):
                p.set(sec,opt,self.misc[sec][opt])

        # try to create the directories and write the file
        try:
            rc_exists = os.path.exists(self.rcfile)
            if not rc_exists and not os.path.exists(os.path.dirname(self.rcfile)):
                os.makedirs(os.path.dirname(self.rcfile))
            try:
                p.write(file(self.rcfile, 'w'))
                if not rc_exists:
                    os.chmod(self.rcfile, 0600)
            except IOError:
                sys.stderr.write("ERROR: couldn't write the config file\n")

        except OSError:
            # what to do if impossible?
            sys.stderr.write("ERROR: couldn't create the config directory\n")

    def get(self, key, default=None):
        if key not in self:
            return default
        return self[key]

    def pop(self, key, default=None):
        val = self.get(key, default=default)
        for dic in self.order:
            dic.pop(key, None)
        return val

    @property
    def addons_data_dir(self):
        path = opj(self['data_dir'], 'addons', release.series)
        if not os.path.exists(path):
            os.makedirs(path, 0700)
        else:
            assert os.access(path, os.W_OK), "%s: directory is not writable" % path
        return path

    @property
    def session_dir(self):
        path = opj(self['data_dir'], 'sessions')
        if not os.path.exists(path):
            os.makedirs(path, 0700)
        else:
            assert os.access(path, os.W_OK), "%s: directory is not writable" % path
        return path

    def filestore(self, dbname):
        return opj(self['data_dir'], 'filestore', dbname)


settings = Settings()

class LegacyConfig(object):
    def __getattr__(self, name):
        import inspect
        (_, filename, line, _, _, _) = inspect.getouterframes(inspect.currentframe())[1]
        print('>>> odoo.tools.config.%s at %s:%s' % (name, filename, line))
        return getattr(settings, name)

    def __getitem__(self, name):
        import inspect
        (_, filename, line, _, _, _) = inspect.getouterframes(inspect.currentframe())[1]
        print('>>> odoo.tools.config["%s"] at %s:%s' % (name, filename, line))
        return settings[name]

config = LegacyConfig()
