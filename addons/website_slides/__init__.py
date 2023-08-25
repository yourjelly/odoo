# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from . import controllers
from . import models
from . import populate
from . import wizard

def uninstall_hook(env):
    slides_fields = env['slide.channel'].get_website_slides_fields()

    mailing_model = env['ir.model'].search([('model', '=', 'mailing.mailing')])
    mailings = env[mailing_model.model].search([])

    for mailing in mailings:
        mailing_domain = mailing.mailing_domain
        modified_domain = [] if [domain_item for domain_item in mailing_domain if domain_item[0] not in slides_fields] else False
        mailing.write({'mailing_domain': modified_domain})
    
