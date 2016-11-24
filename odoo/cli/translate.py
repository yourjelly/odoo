# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
import os

import odoo
from odoo.conf import settings
from . import Command, OptionGroup, Option, server

_logger = logging.getLogger(__name__)


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


def export_translation(dbname, ):
    dbname = settings['db_name'].split(',')[0].strip()
    if settings["language"]:
        msg = "language %s" % settings["language"]
    else:
        msg = "new language"
    _logger.info('writing translation file for %s to %s', msg, settings["translate_out"])

    fileformat = os.path.splitext(settings["translate_out"])[-1][1:].lower()

    with open(settings["translate_out"], "w") as buf:
        registry = odoo.modules.registry.Registry.new(dbname)
        with odoo.api.Environment.manage():
            with registry.cursor() as cr:
                odoo.tools.trans_export(
                    settings["language"],
                    settings["translate_modules"] or ["all"],
                    buf, fileformat, cr)

    _logger.info('translation file written successfully')


def import_translation():
    dbname = settings['db_name'].split(',')[0].strip()
    context = {'overwrite': settings["overwrite_existing_translations"]}

    registry = odoo.modules.registry.Registry.new(dbname)
    with odoo.api.Environment.manage():
        with registry.cursor() as cr:
            odoo.tools.trans_load(
                cr, settings["translate_in"], settings["language"], context=context,
            )


class Translate(Command):
    """
    Translation operations

    Use these options to translate Odoo to another language. See i18n section
    of the user manual. Option '-d' is mandatory. Option '-l' is mandatory in
    case of import.
    """

    def run(self, args):
        groups = [
            i18n_group,
            server.db_group,
        ]
        self.parser.add_option_groups(groups)

        if not args:
            self.parser.exit_with_help()

        opt = self.parser.parse_args(args)

        server.bootstrap()
        if opt.translate_out:
            export_translation()
        elif opt.translate_in:
            import_translation()
