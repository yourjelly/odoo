from . import Command
from odoo.modules.module import get_module_root, MANIFEST_NAMES
import argparse
import glob
import itertools
import os
import sys
import re

class TSConfig(Command):
    """Generates tsconfig files for javascript code"""

    def __init__(self):
        self.command_name = "tsconfig"

    def get_module_list(self, path):
        mods = itertools.chain.from_iterable(
            glob.glob(os.path.join(path, '*/%s' % mname))
            for mname in MANIFEST_NAMES
        )
        return [mod.split(os.path.sep)[-2] for mod in mods]

    def clean_path(self, path):
        regex = r"//+"
        subst = "/"
        return re.sub(regex, subst, path)

    def prefix_suffix_path(self, path, prefix, suffix):
        return self.clean_path(f"{prefix}/{path}/{suffix}")

    def remove_(self, modules, module):
        for name, path in modules:
            if module == name:
                modules.remove((name, path))

    def run(self, cmdargs):
        parser = argparse.ArgumentParser(
            prog="%s %s" % (sys.argv[0].split(os.path.sep)[-1], self.command_name),
            description=self.__doc__
        )

        args, unknown = parser.parse_known_args(args=cmdargs)

        modules = {}
        for path in unknown:   
            for module in self.get_module_list(self.clean_path(f"{path}")):
                modules[module] = self.prefix_suffix_path(module, f"{path}", "/static/src/*")

        content = self.generate_file_content(modules)

        print(content)

    def generate_imports(self, modules):
        return [f""""@{module}/*": ["{path}"]""" for _, (module, path) in enumerate(modules.items())]

    def generate_file_content(self, modules):
        imports = ",\n\t\t".join(self.generate_imports(modules))
        return """
{
    "compilerOptions": {
        "baseUrl": ".",
        "checkJs": true,
        "allowJs": true,
        "noEmit": true,
        "paths": {
        \t%s
        }
    }
}
        """ % imports
