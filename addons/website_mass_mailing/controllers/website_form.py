# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.http import request
from odoo.addons.website.controllers.form import WebsiteForm
from odoo.osv import expression


class WebsiteNewsletterForm(WebsiteForm):

    def _handle_website_form(self, model_name, **kwargs):
        if model_name == 'mailing.contact.subscription':
            model_record = request.env.ref('mass_mailing.model_mailing_contact_subscription')
            searchable_fields = request.env[model_name].sudo()._get_searchable_fields()
            writable_fields = model_record.sudo()._get_form_writable_fields()

            domain = []
            create_vals = {}
            for field, value in request.params.items():
                if field in searchable_fields:
                    domain = expression.OR([domain, [(field.partition('contact_')[2], '=', value)]])
                if field in writable_fields and field.startswith('contact_'):
                    create_vals.update({field: value})
            for field in create_vals:   # remove the fields from the params.
                request.params.pop(field)

            contact = request.env['mailing.contact'].sudo().search(domain)
            if not contact:
                contact = request.env['mailing.contact'].sudo().create({
                    key.partition('contact_')[2]: value for key, value in create_vals.items()
                })
            else:   # update contact with new values
                update_vals = {
                    k.partition('contact_')[2]: v for k, v in create_vals.items()
                    if not contact[k.partition('contact_')[2]]}
                contact.write(update_vals)

            request.params['contact_id'] = contact.id

        return super(WebsiteNewsletterForm, self)._handle_website_form(model_name, **kwargs)
