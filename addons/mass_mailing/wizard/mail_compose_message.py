# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from markupsafe import Markup

from odoo import fields, models
from odoo.tools.misc import file_open


class MailComposeMessage(models.TransientModel):
    _inherit = 'mail.compose.message'

    mass_mailing_id = fields.Many2one('mailing.mailing', string='Mass Mailing', ondelete='cascade')
    campaign_id = fields.Many2one('utm.campaign', string='Mass Mailing Campaign', ondelete='set null')
    mass_mailing_name = fields.Char(string='Mass Mailing Name', help='If set, a mass mailing will be created so that you can track its results in the Email Marketing app.')
    mailing_list_ids = fields.Many2many('mailing.list', string='Mailing List')

    def _action_send_mail(self, auto_commit=False):
        """ Override to generate the mass mailing in case only the name was
        given. It is used afterwards for traces generation. """
        if self.composition_mode == 'mass_mail' and \
                self.mass_mailing_name and not self.mass_mailing_id and \
                self.model_is_thread:
            mass_mailing = self.env['mailing.mailing'].create(self._prepare_mailing_values())
            self.mass_mailing_id = mass_mailing.id
        return super()._action_send_mail(auto_commit=auto_commit)

    def _prepare_mail_values(self, res_ids, mass_include_canceled=False):
        """ If it is a mass mailing:

        - Add 'mailing.trace' values directly in the o2m field for mail not canceled.
        - If not mass_include_canceled, create mailing traces for the canceled mail
        (created in sudo).
        """
        # use only for allowed models in mass mailing
        is_mass_mailing = self.composition_mode == 'mass_mail' and self.mass_mailing_id and self.model_is_thread
        mail_values_all = super()._prepare_mail_values(res_ids,
                                                       mass_include_canceled=mass_include_canceled or is_mass_mailing)

        if not is_mass_mailing:
            return mail_values_all

        canceled_message_traces_values = []
        results = {}
        trace_values_all = self._prepare_mail_values_mailing_traces(mail_values_all)
        with file_open("mass_mailing/static/src/scss/mass_mailing_mail.scss", "r") as fd:
            styles = fd.read()
        for res_id, mail_values in mail_values_all.items():
            if not mass_include_canceled and mail_values.get('state') == 'cancel':
                if res_id in trace_values_all:
                    canceled_message_traces_values.append(trace_values_all[res_id])
                continue
            results[res_id] = mail_values
            if mail_values.get('body_html'):
                body = self.env['ir.qweb']._render(
                    'mass_mailing.mass_mailing_mail_layout',
                    {'body': mail_values['body_html'], 'mailing_style': Markup(f'<style>{styles}</style>')},
                    minimal_qcontext=True,
                    raise_if_not_found=False
                )
                if body:
                    mail_values['body_html'] = body

            mail_values.update({
                'mailing_id': self.mass_mailing_id.id,
                'mailing_trace_ids': [(0, 0, trace_values_all[res_id])] if res_id in trace_values_all else False,
            })
        self.env['mailing.trace'].sudo().create(canceled_message_traces_values)

        return results

    def _get_done_emails(self, mail_values_dict):
        seen_list = super()._get_done_emails(mail_values_dict)
        if self.mass_mailing_id:
            seen_list += self.mass_mailing_id._get_seen_list()
        return seen_list

    def _get_optout_emails(self, mail_values_dict):
        opt_out_list = super()._get_optout_emails(mail_values_dict)
        if self.mass_mailing_id:
            opt_out_list += self.mass_mailing_id._get_opt_out_list()
        return opt_out_list

    def _prepare_mail_values_mailing_traces(self, mail_values_all):
        trace_values_all = dict.fromkeys(mail_values_all.keys(), False)
        recipients_info = self._get_recipients_data(mail_values_all)
        for res_id, mail_values in mail_values_all.items():
            trace_vals = {
                # if mail_to is void, keep falsy values to allow searching / debugging traces
                'email': recipients_info[res_id]['mail_to'][0] if recipients_info[res_id]['mail_to'] else '',
                'mass_mailing_id': self.mass_mailing_id.id,
                'model': self.model,
                'res_id': res_id,
            }
            # propagate failed states to trace when still-born
            if mail_values.get('state') == 'cancel':
                trace_vals['trace_status'] = 'cancel'
            elif mail_values.get('state') == 'exception':
                trace_vals['trace_status'] = 'error'
            if mail_values.get('failure_type'):
                trace_vals['failure_type'] = mail_values['failure_type']
            trace_values_all[res_id] = trace_vals
        return trace_values_all

    def _prepare_mailing_values(self):
        now = fields.Datetime.now()
        return {
            'attachment_ids': [(6, 0, self.attachment_ids.ids)],
            'body_html': self.body,
            'campaign_id': self.campaign_id.id,
            'mailing_model_id': self.env['ir.model']._get(self.model).id,
            'mailing_domain': self.res_domain if self.res_domain else f"[('id', 'in', {self.res_ids})]",
            'name': self.mass_mailing_name,
            'reply_to': self.reply_to if self.reply_to_mode == 'new' else False,
            'reply_to_mode': self.reply_to_mode,
            'sent_date': now,
            'state': 'done',
            'subject': self.subject,
        }
