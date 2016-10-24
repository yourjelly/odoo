#odoo.loggers.handlers. -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import ConfigParser
import logging
import optparse
import os
import sys

import odoo
import odoo.conf
import odoo.loglevels as loglevels
import odoo.release as release
from odoo.tools import appdirs


DEFAULT_LOG_HANDLER = ':INFO'

LOG_LEVELS = [
    'info', 'debug_rpc', 'warn', 'test', 'critical',
    'debug_sql', 'error', 'debug', 'debug_rpc_answer', 'notset'
]

# This will hold the option groups registered by instantiating the Group class
_groups_registry = []


def is_addons_path(path):
    from odoo.modules.module import MANIFEST_NAMES
    for f in os.listdir(path):
        modpath = os.path.join(path, f)
        if os.path.isdir(modpath):
            def hasfile(filename):
                return os.path.isfile(os.path.join(modpath, filename))
            if hasfile('__init__.py') and any(hasfile(mname) for mname in MANIFEST_NAMES):
                return True
    return False

def _check_addons_path(option, opt, value, parser):
    ad_paths = []
    for path in value.split(','):
        path = path.strip()
        res = os.path.abspath(os.path.expanduser(path))
        if not os.path.isdir(res):
            raise optparse.OptionValueError("option %s: no such directory: %r" % (opt, path))
        if not is_addons_path(res):
            raise optparse.OptionValueError("option %s: The addons-path %r does not seem to a be a valid Addons Directory!" % (opt, path))
        ad_paths.append(res)

    setattr(parser.values, option.dest, ",".join(ad_paths))

def _get_default_datadir():
    home = os.path.expanduser('~')
    if os.path.isdir(home):
        func = appdirs.user_data_dir
    else:
        if sys.platform in ['win32', 'darwin']:
            func = appdirs.site_data_dir
        else:
            func = lambda **kwarg: "/var/lib/%s" % kwarg['appname'].lower()
    # No "version" kwarg as session and filestore paths are shared against series
    return func(appname=release.product_name, appauthor=release.author)

def _deduplicate_loggers(loggers):
    """ Avoid saving multiple logging levels for the same loggers to a save
    file, that just takes space and the list can potentially grow unbounded
    if for some odd reason people use :option`--save`` all the time.
    """
    # dict(iterable) -> the last item of iterable for any given key wins,
    # which is what we want and expect. Output order should not matter as
    # there are no duplicates within the output sequence
    return (
        '{}:{}'.format(logger, level)
        for logger, level in dict(it.split(':') for it in loggers).iteritems()
    )


class Group(object):
    """
    Group of command line arguments (iterable)

    :param str title: group title
    :param str description: group description (will be rendered as an indented paragraph)
    :param str section: section name used in configuration file (Defaults to 'options')
    :param bool save: persist the goup's options in the configuration file (Defaults to True)
                      (supersede option's ``save`` attribute if False)
    :param bool hidden: whether the group should be hidden from the help screen (Defaults to False)
                        (supersede option's ``hidden`` attribute if True)
    :param bool disabled: if True the group and it's options will be disabled, values will be ``None``
                          (supersede option's ``disabled`` attribute if True)
    """
    def __init__(self, title=None, description=None, section='options',
                 cli=True, save=True, hidden=False, disabled=False):
        _groups_registry.append(self)
        self.title = title
        self.description = description
        self.section = section
        self.save = save
        self.disabled = disabled
        self.hidden = hidden
        self.options = []
        self._integrity_checks = []

    def __iter__(self):
        for option in self.options:
            yield option

    def _add(self, option):
        assert isinstance(option, Option)
        option.group = self
        self.options.append(option)

    def add_option(self, *args, **kwargs):
        """
        Add an option to the group

        Accepts the same arguments as the :class:`Option` class.
        """
        if any(isinstance(arg, Option) for arg in args):
            raise ValueError("add_option does not takes <Option> instances as argument")
        self._add(Option(*args, **kwargs))

    def add_options(self, *options):
        """
        Adds one or more :class:`Option` instances to the group
        """
        for option in options:
            self._add(option)

    def keys(self):
        """
        Returns a set of ``dest`` attributes in the group's options
        """
        return set([option.dest for option in self])

    def get(self, key, all=False):
        """
        Get the group option whose ``dest`` attribute or one option string matches the given key.

        Example:
            >>> odoo.tools.config_manager.smtp_group.get('--smtp-port')

        .. note::

           In case of linked options sharing the same ``dest`` attribute (eg: :py:attr:`optparse.Option.action`
           with ``append`` and ``append_const``) only the first option found will be returned.
           Use ``all=True` to retreive all of them.
        """
        opts = []
        for group in _groups_registry:
            for option in group.options:
                if option.dest == key or key in option._long_opts or key in option._short_opts:
                    opts.append(option)
        if all:
            return opts
        return opts[0]

    def check(self, func, error_message):
        """
        Add a differed options integrity check.

        :param callable func: callable integrity check
        :param str error_message: used for the parse error in case the callable returns True
        """
        self._integrity_checks.append([func, error_message])

    def integrity_check(self, values):
        """
        Launch the integrity check, returns an error message if the check failed, None otherwise

        :param optparse.Values values: the optparse parsed values
        """
        for func, error_message in self._integrity_checks:
            if func(values):
                return error_message.format(values, opt=values)


class Option(optparse.Option, object):
    """
    An Option inherited from :py:class:`optparse.Option`

    If no option string(s) are provided (positional arguments) it is assumed that the option will not be exposed
    to the command line interface but will still be exposed to the configuration file.


    Additional named arguments:

    :param bool save: persist this option in the configuration file (Defaults to True)
    :param bool hidden: hide this option from the help screen but keep it working through cli.  (Defaults to False)
    :param bool disabled: if True the option will be disabled and it's value will be ``None`` (Defaults to False)
    """
    def __init__(self, *args, **kwargs):
        self.cli = bool(args)
        if not args:
            if 'dest' not in kwargs:
                raise NameError("'dest' argument must be provided if no positional argument are passed")
            args = ['--' + kwargs['dest'].replace('_', '-')]  # create mandatory option string even if we won't use it
        self.save = kwargs.pop('save', True)
        self.hidden = kwargs.pop('hidden', False)
        self.disabled = kwargs.pop('disabled', False)
        self.group = None

        # As we will deal with two sources: configuration file and cli, we need to be able to see if the user actually
        # used a cli argument or not. We keep the `default` argument stored in another attribute, so we can compare the
        # cli values with None to check if the user actually used a particular argument.
        if 'my_default' in kwargs:
            self.my_default = kwargs.pop('my_default')
        else:
            self.my_default = kwargs.pop('default', None)

        super(Option, self).__init__(*args, **kwargs)


# Server startup config group {{{
common_group = Group("Common options")
common_group.add_options(
    Option("-c", "--config", dest="config", help="specify alternate config file", save=False),

    Option("-s", "--save", action="store_true", dest="save", default=False, save=False,
           help="save configuration to ~/.odoorc (or to ~/.openerp_serverrc if it exists)"),

    Option("-i", "--init", dest="init", save=False, help="install one or more modules (comma-separated list, use "
           "\"all\" for all modules), requires -d"),

    Option("-u", "--update", dest="update", save=False, help="update one or more modules (comma-separated list, use "
           "\"all\" for all modules). Requires -d."),

    Option("--without-demo", dest="without_demo", default=False,
           help="disable loading demo data for modules to be installed (comma-separated, use \"all\" for all modules). "
                "Requires -d and -i. Default is %default"),

    Option("-P", "--import-partial", dest="import_partial", default='',
           help="Use this for big data importation, if it crashes you will be able to continue at the current state. "
                "Provide a filename to store intermediate importation states."),

    Option("--pidfile", dest="pidfile", help="file where the server pid will be stored"),

    Option("--addons-path", dest="addons_path", action="callback", callback=_check_addons_path, nargs=1,
           type='string', help="specify additional addons paths (separated by commas)."),

    Option("--load", dest="server_wide_modules", help="Comma-separated list of server-wide modules default=web"),

    Option("-D", "--data-dir", dest="data_dir", default=_get_default_datadir(),
           help="Directory where to store Odoo data"),
)
common_group.check(lambda opt: not opt.save and opt.config and not os.access(opt.config, os.R_OK),
                   "The config file '{0.config}' selected with -c/--config doesn't exist or is not readable, "
                   "use -s/--save if you want to generate it")
# }}}

# XML-RPC / HTTP config group {{{
http_group = Group("XML-RPC Configuration")
http_group.add_options(
    Option("--xmlrpc-interface", dest="xmlrpc_interface", default='',
           help="Specify the TCP IP address for the XML-RPC protocol. The empty string binds to all interfaces."),

    Option("--xmlrpc-port", dest="xmlrpc_port", default=8069, type="int",
           help="specify the TCP port for the XML-RPC protocol"),

    Option("--no-xmlrpc", dest="xmlrpc", action="store_false", default=True, help="disable the XML-RPC protocol"),

    Option("--proxy-mode", dest="proxy_mode", action="store_true", default=False,
           help="Enable correct behavior when behind a reverse proxy"),

    Option("--longpolling-port", dest="longpolling_port", default=8072, type="int",
           help="specify the TCP port for longpolling requests"),
)
# }}}

# WEB config group {{{
web_group = Group("web", "Web interface Configuration")
web_group.add_options(
    Option("--db-filter", dest="dbfilter", default='.*', help="Filter listed database", metavar="REGEXP"),
)
# }}}

# Testing group {{{
testing_group = Group("testing", "Testing Configuration")
testing_group.add_options(
    Option("--test-file", dest="test_file", default=False, help="Launch a python or YML test file."),

    Option("--test-report-directory", dest="test_report_directory", default=False,
           help="If set, will save sample of all reports in this directory."),

    Option("--test-enable", action="store_true", dest="test_enable", default=False, help="Enable YAML and unit tests."),

    Option("--test-commit", action="store_true", dest="test_commit", default=False,
           help="Commit database changes performed by YAML or XML tests."),
)
# }}}

# Logging group {{{
logging_group = Group("Logging Configuration")
logging_group.add_options(
    Option("--logfile", dest="logfile", help="file where the server log will be stored"),

    Option("--logrotate", dest="logrotate", action="store_true", default=False, help="enable logfile rotation"),

    Option("--syslog", action="store_true", dest="syslog", default=False, help="Send the log to the syslog server"),

    Option('--log-handler', action="append", default=[], my_default=DEFAULT_LOG_HANDLER, metavar="PREFIX:LEVEL",
           help='setup a handler at LEVEL for a given PREFIX. An empty PREFIX indicates the root logger. '
                'This option can be repeated. Example: "odoo.orm:DEBUG" or "werkzeug:CRITICAL" (default: ":INFO")'),

    Option('--log-request', action="append_const", dest="log_handler", const="odoo.http.rpc.request:DEBUG",
           help='shortcut for --log-handler=odoo.http.rpc.request:DEBUG'),

    Option('--log-response', action="append_const", dest="log_handler", const="odoo.http.rpc.response:DEBUG",
           help='shortcut for --log-handler=odoo.http.rpc.response:DEBUG'),

    Option('--log-web', action="append_const", dest="log_handler", const="odoo.http:DEBUG",
           help='shortcut for --log-handler=odoo.http:DEBUG'),

    Option('--log-sql', action="append_const", dest="log_handler", const="odoo.sql_db:DEBUG",
           help='shortcut for --log-handler=odoo.sql_db:DEBUG'),

    Option('--log-db', dest='log_db', help="Logging database", default=False),

    Option('--log-db-level', dest='log_db_level', default='warning', help="Logging database level"),

    Option('--log-level', dest='log_level', type='choice', choices=LOG_LEVELS, default='info',
           help='specify the level of the logging. Accepted values: %s.' % (LOG_LEVELS,)),
)
logging_group.check(lambda opt: opt.syslog and opt.logfile, "the syslog and logfile options are exclusive")
# }}}

# SMTP group {{{
smtp_group = Group("SMTP Configuration")
smtp_group.add_options(
    Option('--email-from', dest='email_from', default=False, help='specify the SMTP email address for sending email'),

    Option('--smtp', dest='smtp_server', default='localhost', help='specify the SMTP server for sending email'),

    Option('--smtp-port', dest='smtp_port', default=25, help='specify the SMTP port', type="int"),

    Option('--smtp-ssl', dest='smtp_ssl', action='store_true', default=False,
           help='if passed, SMTP connections will be encrypted with SSL (STARTTLS)'),

    Option('--smtp-user', dest='smtp_user', default=False, help='specify the SMTP username for sending email'),

    Option('--smtp-password', dest='smtp_password', default=False, help='specify the SMTP password for sending email'),
)
# }}}

# Database group {{{
db_group = Group("Database related options")
db_group.add_options(
    Option("-d", "--database", dest="db_name", default=False, help="specify the database name"),

    Option("-r", "--db_user", dest="db_user", default=False, help="specify the database user name"),

    Option("-w", "--db_password", dest="db_password", default=False, help="specify the database password"),

    Option("--pg_path", dest="pg_path", help="specify the pg executable path"),

    Option("--db_host", dest="db_host", default=False, help="specify the database host"),

    Option("--db_port", dest="db_port", default=False, help="specify the database port", type="int"),

    Option("--db_maxconn", dest="db_maxconn", type='int', default=64,
           help="specify the the maximum number of physical connections to posgresql"),

    Option("--db-template", dest="db_template", default="template1",
           help="specify a custom database template to create a new database"),
)
# }}}

# Internationalisation group {{{
i18n_group = Group(
    title="Internationalisation options",
    description="Use these options to translate Odoo to another language. See i18n section of the user manual. "
                "Option '-d' is mandatory. Option '-l' is mandatory in case of importation"
)
i18n_group.add_options(
    Option('--load-language', dest="load_language", save=False,
           help="specifies the languages for the translations you want to be loaded"),

    Option('-l', "--language", dest="language", save=False,
           help="specify the language of the translation file. Use it with --i18n-export or --i18n-import"),

    Option("--i18n-export", dest="translate_out", save=False,
           help="export all sentences to be translated to a CSV file, a PO file or a TGZ archive and exit"),

    Option("--i18n-import", dest="translate_in", save=False,
           help="import a CSV or a PO file with translations and exit. The '-l' option is required."),

    Option("--i18n-overwrite", dest="overwrite_existing_translations", action="store_true", default=False, save=False,
           help="overwrites existing translation terms on updating a module or importing a CSV or a PO file."),

    Option("--modules", dest="translate_modules",
           help="specify modules to export. Use in combination with --i18n-export"),
)
i18n_group.check(lambda opt: opt.translate_in and (not opt.language or not opt.db_name),
                 "the i18n-import option cannot be used without the language (-l) and the database (-d) options")
i18n_group.check(lambda opt: opt.overwrite_existing_translations and not (opt.translate_in or opt.update),
                 "the i18n-overwrite option cannot be used without the i18n-import option or without the update option")
i18n_group.check(lambda opt: opt.translate_out and (not opt.db_name),
                 "the i18n-export option cannot be used without the database (-d) option")
# }}}

# Security group {{{
security_group = Group("Security-related options")
security_group.add_options(
    Option('--no-database-list', action="store_false", dest='list_db', default=True,
           help="disable the ability to return the list of databases"),
)
# }}}

# Advanced group {{{
advanced_group = Group("Advanced options")
advanced_group.add_options(
    Option('--dev', dest='dev_mode', save=False, type='string',
           help="Enable developer mode. Param: List of options separated by comma. "
                "Options : all, [pudb|wdb|ipdb|pdb], reload, qweb, werkzeug, xml"),

    Option('--shell-interface', dest='shell_interface', type='string',
           help="Specify a preferred REPL to use in shell mode. Supported REPLs are: [ipython|ptpython|bpython|python]"),

    Option("--stop-after-init", action="store_true", dest="stop_after_init", default=False, hidden=True, save=False,
           help="stop the server after its initialization"),

    Option("--osv-memory-count-limit", dest="osv_memory_count_limit", default=False, type='int',
           help="Force a limit on the maximum number of records kept in the virtual "
                "osv_memory tables. The default is False, which means no count-based limit."),

    Option("--osv-memory-age-limit", dest="osv_memory_age_limit", default=1.0, type='float',
           help="Force a limit on the maximum age of records kept in the virtual osv_memory tables. "
                "This is a decimal value expressed in hours, and the default is 1 hour."),

    Option("--max-cron-threads", dest="max_cron_threads", default=2, type='int',
           help="Maximum number of threads processing concurrently cron jobs (default 2)."),

    Option("--unaccent", dest="unaccent", default=False, action="store_true",
           help="Use the unaccent function provided by the database when available."),

    Option("--geoip-db", dest="geoip_database", default='/usr/share/GeoIP/GeoLiteCity.dat',
           help="Absolute path to the GeoIP database file."),
)
# }}}

# Multiprocessing group {{{
multiprocess_group = Group("Multiprocessing options", disabled=(os.name == 'posix'),)
multiprocess_group.add_options(
    # TODO sensible default for the three following limits.
    Option("--workers", dest="workers", default=0, type='int',
           help="Specify the number of workers, 0 disable prefork mode."),

    Option("--limit-memory-soft", dest="limit_memory_soft", default=2048 * 1024 * 1024, type='int',
           help="Maximum allowed virtual memory per worker, when reached the worker be reset after the current "
                "request (default 671088640 aka 640MB)."),

    Option("--limit-memory-hard", dest="limit_memory_hard", default=2560 * 1024 * 1024, type='int',
           help="Maximum allowed virtual memory per worker, when reached, any memory allocation will fail "
                "(default 805306368 aka 768MB)."),

    Option("--limit-time-cpu", dest="limit_time_cpu", default=60, type='int',
           help="Maximum allowed CPU time per request (default 60)."),

    Option("--limit-time-real", dest="limit_time_real", default=120, type='int',
           help="Maximum allowed Real time per request (default 120)."),

    Option("--limit-time-real-cron", dest="limit_time_real_cron", default=-1, type='int',
           help="Maximum allowed Real time per cron job. (default: --limit-time-real). Set to 0 for no limit."),

    Option("--limit-request", dest="limit_request", default=8192, type='int',
           help="Maximum number of request to be processed per worker (default 8192)."),
)
# }}}

# Unexposed group {{{
# Those options are deliberately not exposed to the command line but most of them are saved in the config file.
unexposed_group = Group()
unexposed_group.add_options(
    Option(dest="admin_passwd", default='admin'),
    Option(dest="csv_internal_sep", default=','),
    Option(dest="publisher_warranty_url", save=False, default='http://services.openerp.com/publisher-warranty/'),
    Option(dest="reportgz", default=False),
    Option(dest="root_path", default=None, save=False),
)
# }}}


class ConfigManager(object):
    def __init__(self, fname=None):
        """Constructor.

        :param fname: a shortcut allowing to instantiate :class:`configmanager`
                      from Python code without resorting to environment
                      variable
        """
        # This dictionary will contain all the options values once the cli and config files are parsed
        self.options = {}

        # dictionary mapping of <Option> instances with the option names keys
        self.casts = {}

        self.misc = {}
        self.config_file = fname

        self._LOGLEVELS = dict([
            (getattr(loglevels, 'LOG_%s' % x), getattr(logging, x))
            for x in ('CRITICAL', 'ERROR', 'WARNING', 'INFO', 'DEBUG', 'NOTSET')
        ])

        version = "%s %s" % (release.description, release.version)
        self.parser = parser = optparse.OptionParser(version=version, option_class=Option)

        for group in _groups_registry:
            group_disabled = group.disabled or all(option.disabled for option in group)
            # Group is hidden if it's property hidden is True OR all of it's option's hidden property are True
            # OR all of it's options are not exposed to cli (because they did not defined an option string)
            group_hidden = (group.hidden or all(option.hidden for option in group) or
                            all(option.cli is False for option in group))

            # We always create the group but it will not necessarily be added to the parser. This will be decided
            # according to hidden and disabled logic
            opt_group = optparse.OptionGroup(parser, group.title, group.description)
            for option in group:
                if not group.disabled and not option.disabled and option.cli is not False:
                    if group_hidden or option.hidden:
                        # We hide the option from the cli if it is hidden or if it's group is hidden
                        option.help = optparse.SUPPRESS_HELP
                    if group_hidden:
                        parser.add_option(option)
                    else:
                        opt_group.add_option(option)
                # Copy all optparse options (i.e. Option) into self.options.
                if option.dest not in self.options:
                    # The default value of options are filled in early and are decoupled from the cli parsing on purpose
                    # so we know if a user actually used a cli switch or not (See Option)
                    default_value = None if option.disabled else option.my_default
                    if 'append' in option.action:
                        default_value = default_value.split(',')
                    self.options[option.dest] = default_value
                    self.casts[option.dest] = option
            if not group_disabled and not group_hidden:
                parser.add_option_group(opt_group)

        # generate default config
        self._parse_config()

    def parse_config(self, args=None):
        """ Parse the configuration file (if any) and the command-line
        arguments.

        This method initializes odoo.tools.config and openerp.conf (the
        former should be removed in the furture) with library-wide
        configuration values.

        This method must be called before proper usage of this library can be
        made.

        Typical usage of this method:

            odoo.tools.config.parse_config(sys.argv[1:])
        """
        self._parse_config(args)
        odoo.netsvc.init_logger()
        odoo.modules.module.initialize_sys_path()

    def _parse_config(self, args=None):
        if args is None:
            args = []
        opt, args = self.parser.parse_args(args)

        # Ensures no illegitimate argument is silently discarded (avoids insidious "hyphen to dash" problem)
        if args:
            self.parser.error("unrecognized parameters: '%s'" % " ".join(args))

        # Check the integrity of the options
        for group in _groups_registry:
            error = group.integrity_check(opt)
            if error is not None:
                self.parser.error(error)

        # place/search the config file on Win32 near the server installation
        # (../etc from the server)
        # if the server is run by an unprivileged user, he has to specify location of a config file where he has the rights to write,
        # else he won't be able to save the configurations, or even to start the server...
        # TODO use appdirs
        if os.name == 'nt':
            rcfilepath = os.path.join(os.path.abspath(os.path.dirname(sys.argv[0])), 'odoo.conf')
        else:
            rcfilepath = os.path.expanduser('~/.odoorc')
            old_rcfilepath = os.path.expanduser('~/.openerp_serverrc')

            if os.path.isfile(rcfilepath) and os.path.isfile(old_rcfilepath):
                self.parser.error("Found '.odoorc' and '.openerp_serverrc' in your path. Please keep only one of "
                                  "them, preferrably '.odoorc'.")

            if not os.path.isfile(rcfilepath) and os.path.isfile(old_rcfilepath):
                rcfilepath = old_rcfilepath

        self.rcfile = os.path.abspath(
            self.config_file or opt.config or os.environ.get('ODOO_RC') or os.environ.get('OPENERP_SERVER') or rcfilepath)
        self.load()

        # Verify that we want to log or not, if not the output will go to stdout
        if self.options['logfile'] in ('None', 'False'):
            self.options['logfile'] = False
        # the same for the pidfile
        if self.options['pidfile'] in ('None', 'False'):
            self.options['pidfile'] = False
        # and the server_wide_modules
        if self.options['server_wide_modules'] in ('', 'None', 'False'):
            self.options['server_wide_modules'] = 'web,web_kanban'

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

        self.options['root_path'] = os.path.abspath(os.path.expanduser(os.path.expandvars(os.path.join(os.path.dirname(__file__), '..'))))
        if not self.options['addons_path'] or self.options['addons_path']=='None':
            default_addons = []
            base_addons = os.path.join(self.options['root_path'], 'addons')
            if os.path.exists(base_addons):
                default_addons.append(base_addons)
            main_addons = os.path.abspath(os.path.join(self.options['root_path'], '../addons'))
            if os.path.exists(main_addons):
                default_addons.append(main_addons)
            self.options['addons_path'] = ','.join(default_addons)
        else:
            self.options['addons_path'] = ",".join(
                    os.path.abspath(os.path.expanduser(os.path.expandvars(x.strip())))
                      for x in self.options['addons_path'].split(','))

        self.options['init'] = opt.init and dict.fromkeys(opt.init.split(','), 1) or {}
        self.options['demo'] = (dict(self.options['init'])
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

        odoo.conf.addons_paths = self.options['addons_path'].split(',')

        odoo.conf.server_wide_modules = [
            m.strip() for m in self.options['server_wide_modules'].split(',') if m.strip()
        ]

    def load(self):
        p = ConfigParser.ConfigParser()
        try:
            p.read([self.rcfile])
            for (name,value) in p.items('options'):
                if value=='True' or value=='true':
                    value = True
                if value=='False' or value=='false':
                    value = False
                if name in self.casts:

                    if 'append' in self.casts[name].action:
                        # append* action work with lists
                        self.options[name] = value.split(',')
                    else:
                        self.options[name] = value
                else:
                    # we can't yet log something as the logger config is not ready.
                    # in previous versions (< 11) the 'demo' key was wrongly saved in the configuration
                    # file so we will keep this case silent
                    if name != 'demo':
                        # TODO: make a 'pre_logger' that will output stuff once the logging is configured
                        print("Unrecognized option '%s' found in config file. Please Ignored." % name)
            #parse the other sections, as well
            for sec in p.sections():
                if sec == 'options':
                    continue
                if not self.misc.has_key(sec):
                    self.misc[sec]= {}
                for (name, value) in p.items(sec):
                    if value=='True' or value=='true':
                        value = True
                    if value=='False' or value=='false':
                        value = False
                    self.misc[sec][name] = value
        except IOError:
            pass
        except ConfigParser.NoSectionError:
            pass

    def save(self):
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
        return self.options.get(key, default)

    def pop(self, key, default=None):
        return self.options.pop(key, default)

    def get_misc(self, sect, key, default=None):
        return self.misc.get(sect,{}).get(key, default)

    def __setitem__(self, key, value):
        self.options[key] = value
        if key in self.options and isinstance(self.options[key], basestring) and \
                key in self.casts and self.casts[key].type in optparse.Option.TYPE_CHECKER:
            self.options[key] = optparse.Option.TYPE_CHECKER[self.casts[key].type](self.casts[key], key, self.options[key])

    def __getitem__(self, key):
        return self.options[key]

    @property
    def addons_data_dir(self):
        d = os.path.join(self['data_dir'], 'addons', release.series)
        if not os.path.exists(d):
            os.makedirs(d, 0700)
        else:
            assert os.access(d, os.W_OK), \
                "%s: directory is not writable" % d
        return d

    @property
    def session_dir(self):
        d = os.path.join(self['data_dir'], 'sessions')
        if not os.path.exists(d):
            os.makedirs(d, 0700)
        else:
            assert os.access(d, os.W_OK), \
                "%s: directory is not writable" % d
        return d

    def filestore(self, dbname):
        return os.path.join(self['data_dir'], 'filestore', dbname)

config = ConfigManager()
