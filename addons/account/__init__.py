# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import controllers
from . import models
from . import wizard
from . import report

from odoo import api, SUPERUSER_ID


def _auto_install_l10n(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    env.company._install_localization_packages(from_init=True)
