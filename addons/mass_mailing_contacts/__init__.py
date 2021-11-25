# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import models

from odoo import api, SUPERUSER_ID

def uninstall_hook(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    env.ref('mail.action_partner_mass_mail').write(
    {
        'name': 'Send email',
        'res_model': 'mail.compose.message',
        'target': 'new',
        'context': {
            'default_composition_mode': 'mass_mail',
            'default_partner_to': '{{ object.id or \'\' }}',
            'default_use_template': False,
            'default_reply_to_force_new': True,
        },
    })
