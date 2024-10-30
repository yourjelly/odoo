# Part of Odoo. See LICENSE file for full copyright and licensing details.
import argparse
import contextlib
import logging
import sys
from pathlib import Path

import odoo.cli
from odoo.modules import get_module_path, get_modules, initialize_sys_path

commands = {}
"""All loaded commands"""


class Command:
    name = None
    _parser = None

    def __init__(self, *args, **kwargs):
        self.all_commands = commands

    @classmethod
    def prog_name(cls):
        return Path(sys.argv[0]).name.lower()

    @classmethod
    def title(cls):
        return f'{cls.prog_name()} {cls.name.lower()}'

    @classmethod
    def description(cls):
        return cls.__doc__.strip() or ''

    @classmethod
    def epilog(cls):
        return None

    @property
    def parser(self):
        if not self._parser:
            self._parser = argparse.ArgumentParser(
                prog=self.title(),
                description=self.description(),
                epilog=self.epilog(),
            )
        return self._parser

    def get_module_list(self, path):
        from odoo.modules.module import MANIFEST_NAMES  # noqa: PLC0415
        return sorted(
           Path(module_path).parts[-2]
           for pattern in (str(Path('*') / m) for m in MANIFEST_NAMES)
           for module_path in Path(path).glob(pattern)
        )

    def __init_subclass__(cls):
        cls.name = cls.name or cls.__name__.lower()
        commands[cls.name] = cls

    def load_internal_commands(self):
        load_internal_commands()

    def load_addons_commands(self):
        load_addons_commands()

    def find_command(self, name):
        return find_command(name)


def load_internal_commands():
    """Load `commands` from `odoo.cli`"""
    for path in odoo.cli.__path__:
        for module in Path(path).iterdir():
            if module.suffix != '.py':
                continue
            __import__(f'odoo.cli.{module.stem}')


def load_addons_commands():
    """Load `commands` from `odoo.addons.*.cli`"""
    logging.disable(logging.CRITICAL)
    initialize_sys_path()
    for module in get_modules():
        if (Path(get_module_path(module)) / 'cli').is_dir():
            with contextlib.suppress(ImportError):
                __import__(f'odoo.addons.{module}')
    logging.disable(logging.NOTSET)
    return list(commands)


def find_command(name: str) -> Command | None:
    """ Get command by name. """
    # check in the loaded commands
    if command := commands.get(name):
        return command
    # import from odoo.cli
    try:
        __import__(f'odoo.cli.{name}')
    except ImportError:
        pass
    else:
        if command := commands.get(name):
            return command
    # last try, import from odoo.addons.*.cli
    load_addons_commands()
    return commands.get(name)


def main():
    args = sys.argv[1:]

    # The only shared option is '--addons-path=' needed to discover additional
    # commands from modules
    if len(args) > 1 and args[0].startswith('--addons-path=') and not args[1].startswith('-'):
        # parse only the addons-path, do not setup the logger...
        odoo.tools.config._parse_config([args[0]])
        args = args[1:]

    # Default legacy command
    command_name = 'server'

    # Subcommand discovery
    if len(args) and not args[0].startswith('-'):
        command_name = args[0]
        args = args[1:]

    if command := find_command(command_name):
        o = command()
        o.run(args)
    else:
        sys.exit('Unknown command %r' % (command,))
