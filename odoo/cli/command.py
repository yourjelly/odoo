import argparse
from functools import partial
import logging
import optparse
import os
from os.path import join as opj, isdir, isfile
import sys
import textwrap

import odoo
import odoo.release as release

# Those are the global options which have reserved option strings that needs
# to be parsed early during a first pass so we can register the addons paths
RESERVED_OPTION_STRINGS = {
    '-c': 'config',
    '--config': 'config',
    '--addons_path': 'addons_path',
}

# All registered commands classes
commands = {}

# All registered Option instances
_options = {}


def init_settings(args=None, opts=None):
    """
    Initialize the odoo.conf.settings default values using the registered
    Options. If a list of arguments are provided, they will be returned with
    the shared options (--config and --addons-path) stripped out of them.

    This function can be called multiple times:

        1. called by odoo/cli/__init__.py in order to setup default values
        2. called by odoo.cli.main()  (only if using odoo in command line)
    """
    odoo.conf.settings.init_options(_options.values())
    if args is not None:
        shared, args = extract_shared_args(sys.argv[1:])
        if shared:
            if shared.config:
                # TODO: check if file exists
                odoo.conf.settings['config'] = shared.config
                odoo.conf.settings.load_rc_files()
            if shared.addons_path:
                odoo.conf.settings.set_addons_path(shared.addons_path)
    subcommand_discovery()
    return args


def extract_shared_args(args=None):
    """Extract low level arguments from sys.argv"""
    if args is None:
        args = sys.argv
    parser = argparse.ArgumentParser(add_help=False)
    parser.usage = ("%prog [-c/--config CONFIG] [--addons-path ADDONS_PATH] "
                    "<command> [<args>]")
    parser.add_argument('-c', '--config')
    parser.add_argument('--addons-path')
    return parser.parse_known_args(args=args)


def subcommand_discovery():
    """Cycle through addons and import their `cli` submodules if present"""
    logging.disable(logging.CRITICAL)
    for module in odoo.modules.get_modules():
        mod_import = 'odoo.addons.%s.cli' % module
        if mod_import in sys.modules:
            continue
        to_path = partial(opj, odoo.modules.get_module_path(module))
        if isdir(to_path('cli')) and isfile(to_path('cli', '__init__.py')):
            __import__(mod_import)
    logging.disable(logging.NOTSET)


class OptionParser(optparse.OptionParser, object):
    def __init__(self, **kwargs):
        super(OptionParser, self).__init__(option_class=Option, **kwargs)

    def add_option_group(self, group):
        # A group is hidden if it's ``title`` and ``description`` properties are
        # not set or if all it's option's ``help`` properties are not set
        group_hidden = (
            not (group.title or group.description) or
            all(not(option.help) for option in group)
        )

        for option in group:
            if not option.help or group_hidden:
                option.help = optparse.SUPPRESS_HELP
            if group_hidden:
                self.add_option(option)

        self._merge_and_replace_parser(group)
        if not group_hidden:
            super(OptionParser, self).add_option_group(group)

    def _merge_and_replace_parser(self, group):
        # HACK: Due to the internal of optparse an option group is bound to a
        # parser instance at creation time but we want to be able to create
        # independant option groups
        if group.parser is not self:
            self.defaults.update(group.parser.defaults)
            self._long_opt.update(group.parser._long_opt)
            self._short_opt.update(group.parser._short_opt)
            group.parser = self

    def add_option_groups(self, groups):
        for group in groups:
            self.add_option_group(group)

    def parse_args(self, args):
        opt, args = super(OptionParser, self).parse_args(args)

        # Ensures no illegitimate argument is silently discarded
        # (avoids insidious "hyphen to dash" problem)
        if args:
            self.error("unrecognized parameters: '%s'" % " ".join(args))

        # Check the integrity of the options
        for group in self.option_groups:
            error = group.integrity_check(opt)
            if error is not None:
                self.error(error)

        # Update cli settings
        odoo.conf.settings.cli.update(opt.__dict__)
        return opt

    def exit_with_help(self, return_code=-1):
        self.print_help()
        sys.exit(return_code)


class OptionGroup(optparse.OptionGroup, object):
    """
    Group of command line arguments (iterable) with the following modifications:

    - If no ``title`` and no ``description`` arguments are provided, it is
      assumed that the group's ``hidden`` property should be True.

    :param str title: group title
    :param str description: group description rendered as indented paragraph
    :param str section: section name used in configuration file
                        (Defaults to 'options') TODO: actually use this
    :param bool save: persist the goup's options in the configuration file
                      (Defaults to True)
                      (supersede option's ``save`` attribute if False)
    """
    def __init__(self, title=None, description=None, section='options',
                 save=True, options=None):
        # TODO: do we really need cli=False, disable=True ???

        # HACK: This is a throwaway parser instance that will be replaced by
        #       OptionParser.add_option_group() due to the internals of
        #       optparse that needs an option group to be bound to a parser
        #       instance at creation time.
        parser = OptionParser()

        super(OptionGroup, self).__init__(parser, title, description)
        self.section = section
        self._hidden = False
        self.save = save
        self._integrity_checks = []
        if options:
            self.add_options(options)

    def __iter__(self):
        for option in self.option_list:
            yield option

    # def keys(self):
    #     """
    #     Returns a set of ``dest`` attributes in the group's options
    #     """
    #     return set([option.dest for option in self])

    # def get(self, key, all=False):
    #     """
    #     Get the group option whose ``dest`` attribute or one option string matches the given key.

    #     Example:
    #         >>> odoo.tools.config_manager.smtp_group.get('--smtp-port')

    #     .. note::

    #        In case of linked options sharing the same ``dest`` attribute (eg: :py:attr:`optparse.Option.action`
    #        with ``append`` and ``append_const``) only the first option found will be returned.
    #        Use ``all=True` to retreive all of them.
    #     """
    #     opts = []
    #     for option in self.options:
    #         if option.dest == key or key in option._long_opts or key in option._short_opts:
    #             opts.append(option)
    #     if all:
    #         return opts
    #     return opts[0]

    def check(self, func, error_message):
        """
        Add a deffered options integrity check.

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
    An Option inherited from :py:class:`optparse.Option` with the following
    modifications:

    - If no option string(s) are provided (positional arguments) it is assumed
      that the option will not be exposed to the command line interface but
      will still be exposed to the configuration file.

    - If no ``help`` argument is provided, it is assumed that the option is
      exposed to the cli but should be hidden from the help screen.


    Additional named arguments:

    :param bool sanitize: function to call in order to sanitize the value
    :param bool hidden: whether the option should be hidden from help screen
    :param bool save: persist this option in the configuration file
                      (Defaults to True)
    """
    def __init__(self, *args, **kwargs):
        self.cli = bool(args)
        if not args:
            if 'dest' not in kwargs:
                raise NameError("'dest' argument must be provided if no "
                                "positional argument are passed")
            # create mandatory option string even if we won't use it
            args = ['--' + kwargs['dest'].replace('_', '-')]
        self.save = kwargs.pop('save', True)
        self.sanitize = kwargs.pop('sanitize', None)

        # As we will deal with two sources: configuration file and cli, we need
        # to be able to see if the user actually used a cli argument or not.
        # We keep the `default` argument stored in another attribute, so we can
        # store it in a dedicated place in ``odoo.conf.settings.defaults``
        self.my_default = kwargs.pop('default', None)

        super(Option, self).__init__(*args, **kwargs)

        if self.dest:
            # Prevent to use a reserved option string (eg: addons_path, config)
            reserved = set(RESERVED_OPTION_STRINGS.keys()) & set(self._short_opts + self._long_opts)
            for res in reserved:
                opt = RESERVED_OPTION_STRINGS[res]
                if self.dest != opt:
                    msg = "The '%s' option string is reserved by option '%s'"
                    raise ValueError(msg % (res, opt))
            if self.dest in _options and 'append' not in self.action:
                msg = "An Option with `dest` name '%s' is already defined."
                raise NameError(msg % self.dest)
            if self.dest not in _options:
                _options[self.dest] = self


class CommandType(type):
    def __init__(cls, name, bases, attrs):
        super(CommandType, cls).__init__(name, bases, attrs)
        name = getattr(cls, name, cls.__name__.lower())
        cls.name = name
        if name != 'command':
            commands[name] = cls


class Command(object):
    """Subclass this class to define new odoo subcommands """
    __metaclass__ = CommandType

    def __init__(self):
        cls = self.__class__
        name = cls.__name__.lower()
        desc = None
        if cls.__doc__:
            doc = cls.__doc__.strip().splitlines()
            if len(doc) > 1:
                desc = textwrap.dedent('\n'.join(doc[1:])).strip()
        self.parser = OptionParser(
            usage="%%prog %s [options]" % name,
            description=desc,
            add_help_option=False,
        )

    def run(self, args):
        pass


class Help(Command):
    """Display the list of available commands"""
    def run(self, args):
        prog = sys.argv[0].split(os.path.sep)[-1]
        usage = (
            "Usage: %s [--version] [--config=FILE] [--addons-path=PATH] <command>\n\n"
            "Available commands:\n"
        )
        print(usage % prog)
        names = commands.keys()
        padding = max([len(k) for k in names]) + 2
        for k in sorted(names):
            if getattr(commands[k], 'hidden', False):
                continue
            name = k.ljust(padding, ' ')
            doc = (commands[k].__doc__.strip().splitlines()[0] or '').strip()
            print "    %s%s" % (name, doc)
        print textwrap.dedent('''

            Shared Options:
              -c FILE, --config=FILE  Specify additional config file
              --addons-path=PATH      Specify additional addons paths (separated by commas).
        ''')
        print "\nUse '%s <command> --help' for individual command help." % prog


def main():
    # At this point, all core commands have been loaded, but the user might
    # have provided specific addons_path or a custom configuration containing
    # additional addons_path and we need this information to probe new addons
    args = init_settings(sys.argv[1:])

    if '--version' in args:
        print("%s %s" % (release.description, release.version))
        sys.exit()

    # For backward compatibility sake, the default subcommand is server_legacy,
    # but if no argument is given we will display the main help screen listing
    # the available subcommands. Another exception is the `odoo gevent` switch
    # which is consumed early in `odoo.__init__.py` because gevent needs to
    # monkey patch before other IO libs.
    command = "help" if not args and not odoo.evented else "server_legacy"

    if len(args) and not args[0].startswith("-"):
        command = args[0]
        args = args[1:]

    if command in commands:
        o = commands[command]()
        o.run(args)
    else:
        sys.exit('Unknow command %r' % (command,))
