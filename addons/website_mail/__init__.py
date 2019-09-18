# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import controllers
from . import models
from odoo.api import Environment, SUPERUSER_ID

def post_init_hook(cr,registry):
    env = Environment(cr,SUPERUSER_ID,{})
    models = env['ir.model'].search([('is_portal_mixin','=',True),('is_mail_thread','=',True)]).mapped('model')
    messages = env['mail.message'].search([
        ('subtype_id', '!=', False),
        ('subtype_id.internal', '=', False),
        ('model', 'in', models)
    ]).write({'website_published': True})
