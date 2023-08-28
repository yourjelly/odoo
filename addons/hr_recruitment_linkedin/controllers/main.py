# -*- coding: utf-8 -*-
from odoo import http, _
from odoo.fields import Command
from odoo.http import request, Response
from werkzeug.exceptions import Forbidden
import base64
import hashlib
import hmac
import json
import logging

_logger = logging.getLogger(__name__)

class LinkedInJobApplicationController(http.Controller):
    
    _callback_url = '/jobs/linkedin_callback'
    
    def _verify_linkedin_callback_signature(self, linkedin_data, received_signature):
        linkedin_api_secret = request.env['ir.config_parameter'].sudo().get_param('your_module.linkedin_secret_key')
        expected_signature = base64.b64encode(hmac.new(linkedin_api_secret.encode("utf-8"), linkedin_data, hashlib.sha256).digest()).decode()
        
        if not hmac.compare_digest(received_signature, expected_signature):
            _logger.warning(_("Received LinkedIn notification with invalid signature"))
            raise Forbidden()

    def _extract_details(self, json_data):
        job_data = json_data.get('jobApplication', {})
        applicant_data = job_data.get('applicant', {})
        resume_data = applicant_data.get('resumeQuestionResponses', {}).get('resumeQuestionAnswer', {}).get('mediaUrl', '')

        job_id = job_data.get('externalJobId', '')
        job_application_id = job_data.get('jobApplicationId', '')
        applied_at = job_data.get('appliedAt', '')
        full_name = applicant_data.get('contactInformationQuestionResponses', {}).get('firstNameAnswer', {}).get('value', '') + ' ' + applicant_data.get('contactInformationQuestionResponses', {}).get('lastNameAnswer', {}).get('value', '')
        email = applicant_data.get('contactInformationQuestionResponses', {}).get('emailAnswer', {}).get('value', '')
        phone_number = applicant_data.get('contactInformationQuestionResponses', {}).get('cellphoneNumberQuestionAnswer', {}).get('nationalNumber', '')
        cover_letter = applicant_data.get('coverLetterQuestionResponses', {}).get('textCoverLetterQuestionAnswer', {}).get('answer', {}).get('value', '')

        return {
            'job_id': job_id,
            'job_application_id': job_application_id,
            'applied_at': applied_at,
            'full_name': full_name,
            'email': email,
            'phone_number': phone_number,
            'cover_letter': cover_letter,
            'resume_url': resume_data,
        }

    def _create_applicant(self, **applicant_data):
        applicant_vals = {
            'name': applicant_data['full_name'],
            'email_from': applicant_data['email'],
            'partner_name': applicant_data['full_name'],
            'partner_mobile': applicant_data['phone_number'],
            'job_id': applicant_data['job_id'],
            'kanban_state': 'normal',
        }

        stage_id = request.env['hr.recruitment.stage'].sudo().search_read([
            ('fold', '=', False)]
        , ['id'], limit=1)
        applicant_vals['stage_id'] = stage_id[0].get('id')

        cover_letter = applicant_data.get('cover_letter')
        if cover_letter:
            applicant_vals['description'] = cover_letter

        resume_url = applicant_data.get('resume_url')
        if resume_url:
            resume_attachment = self._create_resume_attachment(resume_url)
            applicant_vals['attachment_ids'] = Command.link(resume_attachment.id)

        return request.env['hr.applicant'].sudo().create(applicant_vals)

    def _create_resume_attachment(self, resume_url):
        attachment_vals = {
            'name': 'Resume.pdf',
            'type': 'binary',
            'url': resume_url,
            'res_model': 'hr.applicant',
        }
        return request.env['ir.attachment'].sudo().create(attachment_vals)
    
    @http.route(_callback_url, type='json', auth='none', methods=['POST'])
    def handle_callback(self, **post):
        try:
            linkedin_data = request.httprequest.data
            received_signature = request.httprequest.headers.get('X-LI-Signature')
            self._verify_linkedin_callback_signature(linkedin_data, received_signature)

            decoded_data = base64.b64decode(linkedin_data).decode('utf-8')
            json_data = json.loads(decoded_data)

            extracted_data = self._extract_details(json_data)
            created_applicant = self._create_applicant(**extracted_data)

            if created_applicant:
                response_data = {'status': 'success', 'message': _('Application data received successfully')}
                return Response(json.dumps(response_data), content_type='application/json', status=200)
            else:
                response_data = {'status': 'error', 'message': _('Error creating applicant')}
                return Response(json.dumps(response_data), content_type='application/json', status=500)

        except Exception as e:
            error_message = str(e)
            _logger.warning(_("An error occurred while processing the LinkedIn callback: %s") % error_message)
            response_data = {'status': 'error', 'message': error_message}
            return Response(json.dumps(response_data), content_type='application/json', status=500)
