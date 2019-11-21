# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, exceptions, fields, models, _
from odoo.addons.phone_validation.tools import phone_validation
from odoo.addons.mass_mailing.models.mailing import MASS_MAILING_BUSINESS_MODELS


class MailingSMSTest(models.TransientModel):
    _name = 'mailing.sms.test'
    _description = 'Test SMS Mailing'

    @api.model
    def default_get(self, fields):
        result = super(MailingSMSTest, self).default_get(fields)
        default_mailing_id = self.env.context.get('default_mailing_id')
        if not default_mailing_id or 'resource_ref' not in fields:
            return result
        mailing = self.env['mailing.mailing'].browse(default_mailing_id)
        resource = self.env[mailing.mailing_model_real].search([], limit=1)
        if resource:
            result['resource_ref'] = '%s,%s' % (mailing.mailing_model_real, resource.id)
        return result

    @api.model
    def _selection_target_model(self):
        return [(model.model, model.name) for model in self.env['ir.model'].search([('model', 'in', MASS_MAILING_BUSINESS_MODELS)])]

    def _default_numbers(self):
        return self.env.user.partner_id.phone_sanitized or ""

    numbers = fields.Char(string='Number(s)', required=True,
                          default=_default_numbers, help='Comma-separated list of phone numbers')
    mailing_id = fields.Many2one('mailing.mailing', string='Mailing', required=True, ondelete='cascade')

    use_record = fields.Boolean('Use a real Record',
                                help="If checked, Dynamic placeholders will be replace"
                                " with real data based on the record reference example")
    resource_ref = fields.Reference(string='Record reference example', selection='_selection_target_model')

    def action_send_sms(self):
        self.ensure_one()
        numbers = [number.strip() for number in self.numbers.split(',')]
        sanitize_res = phone_validation.phone_sanitize_numbers_w_record(numbers, self.env.user)
        sanitized_numbers = [info['sanitized'] for info in sanitize_res.values() if info['sanitized']]
        invalid_numbers = [number for number, info in sanitize_res.items() if info['code']]
        if invalid_numbers:
            raise exceptions.UserError(_('Following numbers are not correctly encoded: %s, example : "+32 495 85 85 77, +33 545 55 55 55"') % repr(invalid_numbers))
        body = self.mailing_id.body_plaintext
        if self.use_record and self.resource_ref:
            body = self.env['sms.template']._render_template(body, self.resource_ref._name, self.resource_ref.id)
        self.env['sms.api']._send_sms_batch([{
            'res_id': 0,
            'number': number,
            'content': body
        } for number in sanitized_numbers])
        return True
