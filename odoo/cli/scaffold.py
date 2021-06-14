#!/usr/bin/env python
# -*- coding: utf-8 -*-
from __future__ import print_function
import argparse
import os
import re
import sys
import lxml
from markupsafe import Markup

from odoo.addons.base.models.qweb import QWeb


from . import Command

class Scaffold(Command):
    """ Generates an Odoo module skeleton. """

    def run(self, cmdargs):
        # TODO: bash completion file
        parser = argparse.ArgumentParser(
            prog="%s scaffold" % sys.argv[0].split(os.path.sep)[-1],
            description=self.__doc__,
            epilog=self.epilog(),
        )
        parser.add_argument(
            '-t', '--template', type=template, default=template('default'),
            help="Use a custom module template, can be a template name or the"
                 " path to a module template (default: %(default)s)")
        parser.add_argument('name', help="Name of the module to create")
        parser.add_argument(
            'dest', default='.', nargs='?',
            help="Directory to create the module in (default: %(default)s)")

        if not cmdargs:
            sys.exit(parser.print_help())
        args = parser.parse_args(args=cmdargs)

        args.template.render_to(
            snake(args.name),
            directory(args.dest, create=True),
            {'name': args.name})

    def epilog(self):
        return "Built-in templates available are: %s" % ', '.join(
            d for d in os.listdir(builtins())
            if d != 'base'
        )

builtins = lambda *args: os.path.join(
    os.path.abspath(os.path.dirname(__file__)),
    'templates',
    *args)

def snake(s):
    """ snake cases ``s``

    :param str s:
    :return: str
    """
    # insert a space before each uppercase character preceded by a
    # non-uppercase letter
    s = re.sub(r'(?<=[^A-Z])\B([A-Z])', r' \1', s)
    # lowercase everything, split on whitespace and join
    return '_'.join(s.lower().split())
def pascal(s):
    return ''.join(
        ss.capitalize()
        for ss in re.sub('[_\s]+', ' ', s).split()
    )

def directory(p, create=False):
    expanded = os.path.abspath(
        os.path.expanduser(
            os.path.expandvars(p)))
    if create and not os.path.exists(expanded):
        os.makedirs(expanded)
    if not os.path.isdir(expanded):
        die("%s is not a directory" % p)
    return expanded

class template(object):
    def __init__(self, identifier):
        # TODO: archives (zipfile, tarfile)
        self.id = identifier
        # is identifier a builtin?
        self.path = builtins(identifier)
        if os.path.isdir(self.path):
            return
        # is identifier a directory?
        self.path = identifier
        if os.path.isdir(self.path):
            return
        die("{} is not a valid module template".format(identifier))

    def __str__(self):
        return self.id

    def files(self):
        """ Lists the (local) path and content of all files in the template
        """
        for root, _, files in os.walk(self.path):
            for f in files:
                path = os.path.join(root, f)
                yield path, open(path, 'rb').read()

    def render_to(self, modname, directory, params=None):
        """ Render this module template to ``dest`` with the provided
         rendering parameters
        """
        # overwrite with local
        for path, content in self.files():
            local = os.path.relpath(path, self.path)
            # strip .template extension
            root, ext = os.path.splitext(local)
            if ext == '.template':
                local = root
            dest = os.path.join(directory, modname, local)
            destdir = os.path.dirname(dest)
            if not os.path.exists(destdir):
                os.makedirs(destdir)

            params = params.copy()
            params['snake'] = snake
            params['pascal'] = pascal
            params['lt'] = Markup('&lt;')
            newline_string_hack = '___scaffold_newline_template___'
            params['newline'] = newline_string_hack

            with open(dest, 'wb') as f:
                if ext not in ('.py', '.xml', '.csv', '.js', '.rst', '.html', '.template'):
                    f.write(content)
                else:
                    content_qweb = "<t>"+content.decode()+"</t>"
                    rendered = QWeb().render(lxml.html.fragment_fromstring(content_qweb), params)
                    # qweb strip whitespace so add a text with the variable params[newline]
                    rendered = rendered.decode('utf-8').replace(newline_string_hack+'\n', '\n')
                    rendered = rendered + '\n'

                    f.write(rendered.encode('utf-8'))

def die(message, code=1):
    print(message, file=sys.stderr)
    sys.exit(code)

def warn(message):
    # ASK: shall we use logger ?
    print("WARNING:", message)
