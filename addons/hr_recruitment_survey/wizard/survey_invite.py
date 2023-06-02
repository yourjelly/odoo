# Part of Odoo. See LICENSE file for full copyright and licensing details.

from markupsafe import Markup, escape

from odoo import fields, models, _
from odoo.tools.misc import clean_context


class SurveyInvite(models.TransientModel):
    _inherit = "survey.invite"

    applicant_id = fields.Many2one('hr.applicant', string='Applicant')
    survey_id = fields.Many2one('survey.survey', string='Survey', required=True)

    def _get_done_partners_emails(self, existing_answers):
        partners_done, emails_done, answers = super()._get_done_partners_emails(existing_answers)
        if self.applicant_id.response_ids.filtered(lambda res: res.survey_id.id == self.survey_id.id):
            if existing_answers and self.existing_mode == 'resend':
                partners_done |= self.applicant_id.partner_id
        return partners_done, emails_done, answers

    def _send_mail(self, answer):
        # mail = super()._send_mail(answer)
        subject = self._render_field('subject', answer.ids)[answer.id]
        body = self._render_field('body', answer.ids)[answer.id]
        # post the message
        mail_values = {
            'attachment_ids': [(4, att.id) for att in self.attachment_ids],
            'auto_delete': True,
            'author_id': self.author_id.id,
            'body_html': body,
            'email_from': self.author_id.email_formatted,
            'model': None,
            'res_id': None,
            'subject': subject,
        }
        email_layout_xmlid = self.env.context.get('default_email_layout_xmlid')

        template_ctx = {
                'message': self.env['mail.message'].sudo().new(dict(body=mail_values['body_html'], record_name=self.survey_id.title)),
                'model_description': self.env['ir.model']._get('survey.survey').display_name,
                'company': self.env.company,
            }
        body = self.env['ir.qweb']._render(email_layout_xmlid, template_ctx, minimal_qcontext=True, raise_if_not_found=False)
        self.survey_id.message_notify(
                    body=self.env.ref('hr_recruitment_survey.mail_template_applicant_interview_invite').body_html,
                    partner_ids=self.partner_ids.ids,
                )
        if answer.applicant_id:
            answer.applicant_id.message_post(body=Markup(mail_values['body_html']))   

    def action_invite(self):
        self.ensure_one()
        if self.applicant_id:
            survey = self.survey_id.with_context(clean_context(self.env.context))

            if not self.applicant_id.response_ids.filtered(lambda res: res.survey_id.id == self.survey_id.id):
                self.applicant_id.sudo().write({
                    'response_ids': (self.applicant_id.response_ids | survey.sudo()._create_answer(partner=self.applicant_id.partner_id,
                        **self._get_answers_values())).ids
                })

            partner = self.applicant_id.partner_id
            survey_link = survey._get_html_link(title=survey.title)
            partner_link = partner._get_html_link()
            content = escape(_('The survey %(survey_link)s has been sent to %(partner_link)s')) % {
                'survey_link': survey_link,
                'partner_link': partner_link,
            }
            body = Markup('<p>%s</p>') % content
            self.applicant_id.message_post(body=body)
        return super().action_invite()
