# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import controllers
from . import models
from . import wizard

import odoo
from odoo import api, SUPERUSER_ID
from functools import partial


def post_update_hook(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    View = env['ir.ui.view']

    record_action_dict = registry.load_records_duplicated_views
    for record in View.browse(record_action_dict.keys()):
        action, values = record_action_dict[record.id]
        if action == 'write':
            View._load_records_write_helper(record, values)
        else:
            View._load_records_create_helper(record)

    record_action_dict.clear()

def uninstall_hook(cr, registry):
    def rem_website_id_null(dbname):
        db_registry = odoo.modules.registry.Registry.new(dbname)
        with api.Environment.manage(), db_registry.cursor() as cr:
            env = api.Environment(cr, SUPERUSER_ID, {})
            env['ir.model.fields'].search([
                ('name', '=', 'website_id'),
                ('model', '=', 'res.config.settings'),
            ]).unlink()
    cr.after('commit', partial(rem_website_id_null, cr.dbname))
