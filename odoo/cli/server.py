# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

"""
OpenERP - Server
OpenERP is an ERP+CRM program for small and medium businesses.

The whole source code is distributed under the terms of the
GNU Public Licence.

(c) 2003-TODAY, Fabien Pinckaers - OpenERP SA
"""

import atexit
import csv
import logging
import optparse
import os
import sys

import odoo
from odoo.conf import settings

from . import Command, OptionGroup, Option

__author__ = odoo.release.author
__version__ = odoo.release.version

# Also use the `odoo` logger for the main script.
_logger = logging.getLogger('odoo')

DEFAULT_LOG_HANDLER = ':INFO'

LOG_LEVELS = [
    'info', 'debug_rpc', 'warn', 'test', 'critical',
    'debug_sql', 'error', 'debug', 'debug_rpc_answer', 'notset'
]


def _check_addons_path(option, opt, value, parser):
    ad_paths = []
    for path in value.split(','):
        path = path.strip()
        res = os.path.abspath(os.path.expanduser(path))
        if not os.path.isdir(res):
            raise optparse.OptionValueError("option %s: no such directory: %r" % (opt, path))
        if not odoo.modules.is_addons_path(res):
            raise optparse.OptionValueError("option %s: The addons-path %r does not seem to a be a valid Addons Directory!" % (opt, path))
        ad_paths.append(res)

    setattr(parser.values, option.dest, ",".join(ad_paths))


def sanitize_dict(value):
    if value:
        return dict.fromkeys(value.split(','), 1)
    return {}


# Database options {{{
db_group = OptionGroup("Database related options")
db_group.add_options([
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
])
# }}}

# Server startup config group {{{
common_group = OptionGroup("Common options")
common_group.add_options([
    Option("-c", "--config", dest="config", help="specify alternate config file", save=False),

    Option("-s", "--save", action="store_true", dest="save", default=False, save=False,
           help="save configuration to ~/.odoorc (or to ~/.openerp_serverrc if it exists)"),

    Option("-i", "--init", dest="init", save=False, sanitize=sanitize_dict,
           help="install one or more modules (comma-separated list, use \"all\" for all modules), requires -d"),

    Option("-u", "--update", dest="update", save=False, sanitize=sanitize_dict,
           help="update one or more modules (comma-separated list, use \"all\" for all modules). Requires -d."),

    Option("--without-demo", dest="without_demo", default=False,
           help="disable loading demo data for modules to be installed (comma-separated, use \"all\" for all modules). "
                "Requires -d and -i. Default is %default"),

    Option("-P", "--import-partial", dest="import_partial", default='',
           help="Use this for big data importation, if it crashes you will be able to continue at the current state. "
                "Provide a filename to store intermediate importation states."),

    Option("--pidfile", dest="pidfile", help="file where the server pid will be stored"),

    Option("--addons-path", dest="addons_path", action="callback", callback=_check_addons_path, nargs=1,
           type='string', help="specify additional addons paths (separated by commas)."),

    Option("--load", dest="server_wide_modules", help="Comma-separated list of server-wide modules.", default='web,web_kanban'),

    Option("-D", "--data-dir", dest="data_dir", default=odoo.conf._get_default_datadir(),
           help="Directory where to store Odoo data"),
])
common_group.check(lambda opts: not opts.save and opts.config and not os.access(opts.config, os.R_OK),
                   "The config file '{0.config}' selected with -c/--config doesn't exist or is not readable, "
                   "use -s/--save if you want to generate it")
# }}}

# HTTP config group {{{
http_group = OptionGroup("HTTP Configuration")
http_group.add_options([
    Option("--http-interface", dest="http_interface", default='',
           help="Specify the TCP IP address for the HTTP protocol. The empty string binds to all interfaces."),

    Option("--http-port", dest="http_port", default=8069, type="int",
           help="specify the TCP port for the HTTP protocol"),

    Option("--no-xmlrpc", dest="xmlrpc", action="store_false", default=True, help="disable the XML-RPC protocol"),

    Option("--proxy-mode", dest="proxy_mode", action="store_true", default=False,
           help="Enable correct behavior when behind a reverse proxy"),

    Option("--longpolling-port", dest="longpolling_port", default=8072, type="int",
           help="specify the TCP port for longpolling requests"),
])
# }}}

# WEB config group {{{
web_group = OptionGroup("Web interface Configuration")
web_group.add_options([
    Option("--db-filter", dest="dbfilter", default='.*', help="Filter listed database", metavar="REGEXP"),
])
# }}}

# Testing group {{{
testing_group = OptionGroup("Testing Configuration")
testing_group.add_options([
    Option("--test-file", dest="test_file", default=False, help="Launch a python or YML test file."),

    Option("--test-report-directory", dest="test_report_directory", default=False,
           help="If set, will save sample of all reports in this directory."),

    Option("--test-enable", action="store_true", dest="test_enable", default=False, help="Enable YAML and unit tests."),

    Option("--test-commit", action="store_true", dest="test_commit", default=False,
           help="Commit database changes performed by YAML or XML tests."),
])
# }}}

# Logging group {{{
logging_group = OptionGroup("Logging Configuration")
logging_group.add_options([
    Option("--logfile", dest="logfile", help="file where the server log will be stored"),

    Option("--logrotate", dest="logrotate", action="store_true", default=False, help="enable logfile rotation"),

    Option("--syslog", action="store_true", dest="syslog", default=False, help="Send the log to the syslog server"),

    # TODO: fix this exception, should work in all cases
    Option('--log-handler', action="append", default=[DEFAULT_LOG_HANDLER], metavar="PREFIX:LEVEL",
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
])
logging_group.check(lambda opts: opts.syslog and opts.logfile, "the syslog and logfile options are exclusive")
# }}}

# SMTP group {{{
smtp_group = OptionGroup("SMTP Configuration")
smtp_group.add_options([
    Option('--email-from', dest='email_from', default=False, help='specify the SMTP email address for sending email'),

    Option('--smtp', dest='smtp_server', default='localhost', help='specify the SMTP server for sending email'),

    Option('--smtp-port', dest='smtp_port', default=25, help='specify the SMTP port', type="int"),

    Option('--smtp-ssl', dest='smtp_ssl', action='store_true', default=False,
           help='if passed, SMTP connections will be encrypted with SSL (STARTTLS)'),

    Option('--smtp-user', dest='smtp_user', default=False, help='specify the SMTP username for sending email'),

    Option('--smtp-password', dest='smtp_password', default=False, help='specify the SMTP password for sending email'),
])
# }}}

# Internationalisation group {{{
i18n_group = OptionGroup(
    title="Internationalisation options",
    description="Use these options to translate Odoo to another language. See i18n section of the user manual. "
                "Option '-d' is mandatory. Option '-l' is mandatory in case of importation"
)
i18n_group.add_options([
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
])
i18n_group.check(lambda opts: opts.translate_in and (not opts.language or not opts.db_name),
                 "the i18n-import option cannot be used without the language (-l) and the database (-d) options")
i18n_group.check(lambda opts: opts.overwrite_existing_translations and not (opts.translate_in or opts.update),
                 "the i18n-overwrite option cannot be used without the i18n-import option or without the update option")
i18n_group.check(lambda opts: opts.translate_out and (not opts.db_name),
                 "the i18n-export option cannot be used without the database (-d) option")
# }}}

# Security group {{{
security_group = OptionGroup("Security-related options")
security_group.add_options([
    Option('--no-database-list', action="store_false", dest='list_db', default=True,
           help="disable the ability to return the list of databases"),
])
# }}}

# Advanced group {{{
advanced_group = OptionGroup("Advanced options")

dev_mode_items = 'pudb wdb ipdb pdb'.split()
def sanitize_dev_mode(value):
    value = [opt.strip() for opt in value.split(',')] if value else []
    if 'all' in value:
        value += ['pdb', 'reload', 'qweb', 'werkzeug', 'xml']
    return set(value)

advanced_group.add_options([
    Option('--dev', dest='dev_mode', save=False, type='string', sanitize=sanitize_dev_mode,
           help="Enable developer mode. Param: List of options separated by comma. "
                "Options : all, [%s], reload, qweb, werkzeug, xml" % '|'.join(dev_mode_items)),

    # stop the server after its initialization
    Option("--stop-after-init", action="store_true", dest="stop_after_init", default=False, save=False),

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
])
# }}}

# Multiprocessing group {{{
multiprocess_group = OptionGroup("Multiprocessing options")
multiprocess_group.add_options([
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
])
# }}}

# Windows specific {{{
windows_group = OptionGroup("Windows options")
windows_group.add_options([
    Option("--bin-path", dest="bin_path", default=None, type='string',
           help="Specify the path where Odoo should search for external binaries."),
])
# }}}

# Unexposed group {{{
# Those options are deliberately not exposed to the command line but are saved in the config file.
unexposed_group = OptionGroup()
unexposed_group.add_options([
    Option(dest="admin_passwd", default='admin'),
    Option(dest="csv_internal_sep", default=','),
])
# }}}


def check_root_user():
    """Warn if the process's user is 'root' (on POSIX system)."""
    if os.name == 'posix':
        import pwd
        if pwd.getpwuid(os.getuid())[0] == 'root':
            sys.stderr.write("Running as user 'root' is a security risk.\n")

def check_postgres_user():
    """ Exit if the configured database user is 'postgres'.

    This function assumes the configuration has been initialized.
    """
    config = odoo.tools.config
    if config['db_user'] == 'postgres':
        sys.stderr.write("Using the database user 'postgres' is a security risk, aborting.")
        sys.exit(1)

def report_configuration():
    """ Log the server version and some configuration values.

    This function assumes the configuration has been initialized.
    """
    _logger.info("Odoo version %s", __version__)
    for rcfile in settings.loaded_files:
        if os.path.isfile(rcfile):
            _logger.info("Loaded configuration file %s" % rcfile)
    _logger.info('addons paths: %s', odoo.modules.module.ad_paths)
    host = settings['db_host'] or os.environ.get('PGHOST', 'default')
    port = settings['db_port'] or os.environ.get('PGPORT', 'default')
    user = settings['db_user'] or os.environ.get('PGUSER', 'default')
    _logger.info('database: %s@%s:%s', user, host, port)

def rm_pid_file(main_pid):
    config = odoo.tools.config
    if config['pidfile'] and main_pid == os.getpid():
        try:
            os.unlink(config['pidfile'])
        except OSError:
            pass

def setup_pid_file():
    """ Create a file with the process id written in it.

    This function assumes the configuration has been initialized.
    """
    config = odoo.tools.config
    if not odoo.evented and config['pidfile']:
        pid = os.getpid()
        with open(config['pidfile'], 'w') as fd:
            fd.write(str(pid))
        atexit.register(rm_pid_file, pid)

def main():
    check_root_user()
    odoo.netsvc.init_logger()
    odoo.modules.module.initialize_sys_path()
    check_postgres_user()
    report_configuration()

    config = odoo.tools.config

    # the default limit for CSV fields in the module is 128KiB, which is not
    # quite sufficient to import images to store in attachment. 500MiB is a
    # bit overkill, but better safe than sorry I guess
    csv.field_size_limit(500 * 1024 * 1024)

    preload = []
    if config['db_name']:
        preload = config['db_name'].split(',')
        for db_name in preload:
            try:
                odoo.service.db._create_empty_database(db_name)
            except odoo.service.db.DatabaseExists:
                pass

    if config["translate_out"]:
        export_translation()
        sys.exit(0)

    if config["translate_in"]:
        import_translation()
        sys.exit(0)

    # This needs to be done now to ensure the use of the multiprocessing
    # signaling mecanism for registries loaded with -d
    if config['workers']:
        odoo.multi_process = True

    stop = config["stop_after_init"]

    setup_pid_file()
    rc = odoo.service.server.start(preload=preload, stop=stop)
    sys.exit(rc)


class Server(Command):
    """Start the odoo server"""
    def run(self, args):
        groups = [
            db_group,
            common_group,
            http_group,
            web_group,
            testing_group,
            logging_group,
            smtp_group,
            i18n_group,
            security_group,
            advanced_group,
            multiprocess_group,
            windows_group,
            unexposed_group,
        ]
        if os.name == 'posix':
            groups.remove(windows_group)
        else:
            groups.remove(multiprocess_group)

        self.parser.add_option_groups(groups)
        self.parser.parse_args(args)
        main()
