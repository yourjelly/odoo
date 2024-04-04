# Part of Odoo. See LICENSE file for full copyright and licensing details.

import re

from odoo import _, fields, models
from odoo.addons.sms.tools.sms_api import SmsApi
from odoo.exceptions import ValidationError
from odoo.tools.translate import _lt


ERROR_MESSAGES = {
    # Errors that could occur while sending the verification code
    'invalid_phone_number': _lt("Invalid phone number, please make sure to follow the international format."),
    'verification_sms_delivery': _lt(
        "We were not able to reach you via your phone number. "
        "If you have requested multiple codes recently, please retry later."
    ),
    'closed_feature': _lt("The SMS Service is currently unavailable for new users and new accounts registrations are suspended."),
    'banned_account': _lt("This phone number/account has been banned from our service."),


    # Errors that could occur while verifying the code
    'invalid_code': _lt("The verification code is incorrect."),
    'no_sms_account': _lt("We were not able to find your account in our database."),
    'too_many_attempts': _lt("You tried too many times. Please retry later."),

    # Default error
    'unknown_error': _lt("An unknown error occurred. Please contact Odoo support if this error persists."),
}


class SMSAccountRegistrationPhoneNumberWizard(models.TransientModel):
    _name = 'sms.account.registration.phone.number.wizard'
    _description = 'SMS Account Registration Phone Number Wizard'

    account_id = fields.Many2one('iap.account')
    phone_number = fields.Char(required=True)

    def action_send_verification_code(self):
        status = SmsApi(self.env)._send_verification_sms(
            self.account_id.account_token,
            self.phone_number,
        )['state']
        if status != 'success':
            raise ValidationError(ERROR_MESSAGES.get(status, ERROR_MESSAGES['unknown_error']))

        verification_code_wizard = self.env['sms.account.verification.code.wizard'].create({
            'account_id': self.account_id.id,
        })

        return {
            'type': 'ir.actions.act_window',
            'target': 'new',
            'name': _('Register Account'),
            'view_mode': 'form',
            'res_model': 'sms.account.verification.code.wizard',
            'res_id': verification_code_wizard.id,
        }


class SMSAccountRegistrationWizard(models.TransientModel):
    _name = 'sms.account.verification.code.wizard'
    _description = 'SMS Account Verification Code Wizard'

    account_id = fields.Many2one('iap.account')
    verification_code = fields.Char()

    def action_register(self):
        status = SmsApi(self.env)._register_account(
            self.account_id.account_token,
            self.verification_code,
        )['state']
        if status != 'success':
            raise ValidationError(ERROR_MESSAGES.get(status, ERROR_MESSAGES['unknown_error']))

        self.account_id.registered = True
        self.env['iap.account']._send_success_notification(
            message=_("Your SMS account has been successfully registered."),
        )

        sender_name_wizard = self.env['sms.account.sender.name.wizard'].create({
            'account_id': self.account_id.id,
        })

        return {
            'type': 'ir.actions.act_window',
            'target': 'new',
            'name': _('Choose your sender name'),
            'view_mode': 'form',
            'res_model': 'sms.account.sender.name.wizard',
            'res_id': sender_name_wizard.id,
        }


class SMSAccountSenderNameWizard(models.TransientModel):
    _name = 'sms.account.sender.name.wizard'
    _description = 'SMS Account Sender Name Wizard'

    account_id = fields.Many2one('iap.account')
    sender_name = fields.Char()

    def action_set_sender_name(self):
        cleaned_sender_name = re.sub(r"\s+", " ", self.sender_name.strip())
        if not (re.match(r"[a-zA-Z0-9\- ]{3,11}", cleaned_sender_name)):
            raise ValidationError("Your sender name must be between 3 and 11 characters long and only contain alphanumeric characters.")

        # TODO: reach out to IAP services to update the sender name
        self.account_id.sms_sender_name = cleaned_sender_name


class IapAccount(models.Model):
    _inherit = 'iap.account'

    sms_sender_name = fields.Char("Sender Name", help="This is the name that will be displayed as the sender of the SMS.", readonly=True)

    def action_open_registration_wizard(self):
        phone_number_wizard = self.env['sms.account.registration.phone.number.wizard'].create({
            'account_id': self.id,
            'phone_number': self.env.user.mobile or self.env.user.phone,
        })
        return {
            'type': 'ir.actions.act_window',
            'target': 'new',
            'name': _('Register Account'),
            'view_mode': 'form',
            'res_model': 'sms.account.registration.phone.number.wizard',
            'res_id': phone_number_wizard.id,
        }

    def action_open_sender_name_wizard(self):
        sender_name_wizard = self.env['sms.account.sender.name.wizard'].create({
            'account_id': self.id,
        })
        return {
            'type': 'ir.actions.act_window',
            'target': 'new',
            'name': _('Choose your sender name'),
            'view_mode': 'form',
            'res_model': 'sms.account.sender.name.wizard',
            'res_id': sender_name_wizard.id,
        }
