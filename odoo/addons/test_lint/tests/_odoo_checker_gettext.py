import re

import astroid
import pylint.interfaces
from pylint.checkers import BaseChecker

try:
    from pylint.checkers.utils import only_required_for_messages
except ImportError:
    from pylint.checkers.utils import check_messages as only_required_for_messages

# https://docs.python.org/2.6/library/stdtypes.html#string-formatting-operations
PLACEHOLDER_REGEXP = re.compile(r"""
    (?<!%)             # avoid matching escaped %
    %
    [#0\- +]*          # conversion flag
    (?:\d+|\*)?        # minimum field width
    (?:\.(?:\d+|\*))?  # precision
    [hlL]?             # length modifier
    [bcdeEfFgGnorsxX]  # conversion type
""", re.VERBOSE)
REPR_REGEXP = re.compile(r"%(?:\(\w+\))?r")


def parse_version(s):
    # can't use odoo.tools.parse_version because pythonpath is screwed from
    # inside pylint on runbot
    return [s.rjust(3, '0') for s in s.split('.')]


class OdooBaseChecker(BaseChecker):
    if parse_version(pylint.__version__) < parse_version('2.14.0'):
        __implements__ = pylint.interfaces.IAstroidChecker
    name = 'odoo'

    msgs = {
        'E8502': (
            'Bad usage of _, _lt function.',
            'gettext-variable',
            'See https://www.odoo.com/documentation/master/developer/misc/i18n/translations.html#variables'
        ),
        'E8505': (
            'Usage of _, _lt function with multiple unnamed placeholders',
            'gettext-placeholders',
            'Use keyword arguments when you have multiple placeholders',
        ),
        'E8506': (
            'Usage of %r in _, _lt function',
            'gettext-repr',
            'Don\'t use %r to automatically insert quotes in translation strings. Quotes can be different depending on the language: they must be part of the translated string.',
        ),
        'E8507': (
            'Call to gettext in Markup',
            'markup-gettext',
            'TODO',
        ),
    }

    @only_required_for_messages('gettext-variable', 'gettext-placeholders', 'gettext-repr', 'markup-gettext')
    def visit_call(self, node):
        if isinstance(node.func, astroid.Name) and node.func.name in ('_', '_lt'):
            first_arg = node.args[0]
            if isinstance(first_arg.value, str):
                if not isinstance(first_arg, astroid.Const):
                    self.add_message('gettext-variable', node=node)
                elif len(PLACEHOLDER_REGEXP.findall(str(first_arg.value))) >= 2:
                    self.add_message('gettext-placeholders', node=node)
                elif re.search(REPR_REGEXP, first_arg.value):
                    self.add_message('gettext-repr', node=node)
        if isinstance(node.func, astroid.Name) and node.func.name == 'Markup' and node.args:
            first_arg = node.args[0]
            if isinstance(first_arg, astroid.Call) and isinstance(first_arg.func, astroid.Name) and first_arg.func.name in ('_', '_lt'):
                self.add_message('markup-gettext', node=node)


def register(linter):
    linter.register_checker(OdooBaseChecker(linter))
