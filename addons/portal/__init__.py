# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

# Updating mako environement in order to be able to use slug
try:
    import threading
    from odoo.tools.rendering_tools import template_env_globals
    from odoo.modules.registry import Registry

    template_env_globals.update({
        'slug': lambda value: Registry(threading.current_thread().dbname)['ir.http']._slug(value)  # noqa: PLW0108
    })
except ImportError:
    pass

from . import controllers
from . import models
from . import wizard
