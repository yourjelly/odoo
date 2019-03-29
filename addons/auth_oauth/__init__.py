# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, SUPERUSER_ID
from . import controllers
from . import models

def neuter(cr,registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    active_providers = env['auth.oauth.provider'].search([('enabled','=',True)])
    active_providers.write({'enabled':False,'has_been_neutered':True})

def reverse_neuter(cr,registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    neutered_providers = env['auth.oauth.provider'].search([('has_been_neutered','=',True)])
    neutered_providers.write({'enabled':True,'has_been_neutered':False})
