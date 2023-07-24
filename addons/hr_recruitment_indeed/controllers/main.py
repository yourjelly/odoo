# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import hashlib
import hmac
import json
import logging
import uuid

from odoo import http, _
from urllib.parse import quote
from odoo.fields import Command
from odoo.http import request, Response
from werkzeug.exceptions import Forbidden
from odoo.http import content_disposition, request

_logger = logging.getLogger(__name__)

class HrIndeedRecruitment(http.Controller):

    def _prepare_indeed_apply_data(self, jobs):
        indeed_api_token = request.env['ir.config_parameter'].sudo().get_param('hr_recruitment_indeed.indeed_api_token')
        job_feed_data = []
        for job in jobs:
            job_name = job.name.lower().replace(" ","-")
            indeed_job_url = quote(f"{request.env.user.get_base_url()}/jobs/detail/{job_name}-{job.id}").replace('/', '%2F')
            create_date_gmt = job.create_date.strftime('%a, %d %b %Y %H:%M:%S GMT')
            data = 'indeed-apply-apiToken=%s&indeed-apply-jobTitle=%s&indeed-apply-jobId=%s&indeed-apply-jobCompanyName=%s&indeed-apply-jobLocation=%s&indeed-apply-jobUrl=%s&indeed-apply-posturl=%s' % (
                indeed_api_token,
                job.name,
                job.id,
                job.company_id.name,
                job.company_id.street,
                indeed_job_url,
                quote(f"{request.env.user.get_base_url()}/jobs/indeed_callback").replace('/', '%2F')
            )
            job_feed_data.append({
                'title': f"<![CDATA[{job.name}]]>",
                'date': f"<![CDATA[{create_date_gmt}]]>",
                'referencenumber': f"<![CDATA[{job.id}]]>",
                'requisitionid': f"<![CDATA[{job.id}]]>",
                'url': f"<![CDATA[{job.company_id.website}/jobs/detail/{job_name}-{job.id}?source=Indeed]]>",
                'company': f"<![CDATA[{job.company_id.name}]]>",
                'salary': f"<![CDATA[{job.salary}]]>",
                'city': f"<![CDATA[{job.company_id.city}]]>",
                'state': f"<![CDATA[{job.company_id.state_id.name}]]>",
                'country': f"<![CDATA[{job.company_id.country_id.name}]]>",
                'postalcode': f"<![CDATA[{job.company_id.zip}]]>",
                'streetaddress': f"<![CDATA[{job.company_id.street}]]>",
                'email': f"<![CDATA[{job.company_id.email}]]>",
                'description': f"<![CDATA[{job.description}]]>",
                'jobtype': f"<![CDATA[{job.contract_type_id.name}]]>",
                'indeed-apply-data': data
            })

        return job_feed_data

    @http.route('/jobs/feed.xml', type='http', auth="public", website=True)
    def job_feed(self):
        jobs = request.env['hr.job'].sudo().search([('is_published' , '=' , True)], limit=5)
        if not jobs:
            _logger.warning(_("No job found to generate job feed."))
            return request.not_found()

        job_position = request.env['hr.job'].browse(jobs[0].id)
        if not job_position:
            _logger.warning(_("Job position with ID \"%s\" not found.") % jobs[0].id)
            return request.not_found()

        template_vals = self._prepare_indeed_apply_data(jobs)

        content = request.env['ir.qweb']._render('hr_recruitment_indeed.job_feed', {'data': template_vals})
        content_with_source = """<?xml version="1.0" encoding="utf-8"?>
<source>%s</source>"""%(content)
        return request.make_response(
            content_with_source,
            headers=[
                ('Content-Type', 'text/xml'),
                ('Content-Disposition', content_disposition("job_data.xml"))
            ]
        )

    def _verify_indeed_callback_signature(self, indeed_data, received_signature):
        indeed_api_secret = request.env['ir.config_parameter'].sudo().get_param('hr_recruitment_indeed.indeed_secret_key')
        expected_signature = base64.b64encode(hmac.new(indeed_api_secret.encode("utf-8"), indeed_data, hashlib.sha1).digest()).decode()
        if not hmac.compare_digest(received_signature, expected_signature):
            _logger.warning(_("Received notification with invalid signature"))
            raise Forbidden()

    def _extract_details(self, json_data):
        job_data = json_data.get('job', {})
        applicant_data = json_data.get('applicant', {})
        resume_data = applicant_data.get('resume', {}).get('file', {}).get('data', '')

        job_id = job_data.get('jobId', '')
        job_title = job_data.get('jobTitle', '')
        full_name = applicant_data.get('fullName', '')
        email = applicant_data.get('email', '')
        phone_number = applicant_data.get('phoneNumber', '')
        cover_letter = applicant_data.get('coverletter', '')

        return {
            'job_id': job_id,
            'job_title': job_title,
            'full_name': full_name,
            'email': email,
            'phone_number': phone_number,
            'cover_letter': cover_letter,
            'resume_file': resume_data,
        }

    def _create_applicant_record(self, **applicant_data):
        applicant_vals = {
            'name': applicant_data['job_title'],
            'description': applicant_data['cover_letter'],
            'email_from': applicant_data['email'],
            'partner_name': applicant_data['full_name'],
            'partner_mobile': applicant_data['phone_number'],
            'job_id': int(applicant_data['job_id']),
            'kanban_state': 'normal',
        }

        stage_id = request.env['hr.recruitment.stage'].sudo().search_read([
            ('fold', '=', False)]
        , ['id'], limit=1)
        applicant_vals['stage_id'] = stage_id[0].get('id')

        resume_file = applicant_data.get('resume_file')
        if resume_file:
            full_name = applicant_data['full_name'].replace(" ", "_")
            resume_file_name = f"{full_name}_resume.pdf"
            attachment_vals = {
                'name': resume_file_name,
                'datas': resume_file,
                'type': 'binary',
                'mimetype': 'application/pdf',
                'res_model': 'hr.applicant',
            }
            attachment = request.env['ir.attachment'].sudo().create(attachment_vals)
            applicant_vals['attachment_ids'] = Command.link(attachment.id)

        return request.env['hr.applicant'].sudo().create(applicant_vals)

    @http.route('/jobs/indeed_callback', type='http', auth="public", csrf=False, methods=['POST'])
    def handle_callback(self):
        try:
            indeed_data = request.httprequest.data
            received_signature = request.httprequest.headers.get('X-Indeed-Signature')
            self._verify_indeed_callback_signature(indeed_data, received_signature)

            decoded_data = base64.b64decode(indeed_data).decode('utf-8')
            json_data = json.loads(decoded_data)

            extracted_data = self._extract_details(json_data)
            self._create_applicant_record(**extracted_data)

            response_data = {'status': 'success', 'message': _('Application data received successfully')}
            return Response(json.dumps(response_data), content_type='application/json', status=200)

        except Exception as e:
            error_message = str(e)
            _logger.warning(_("An error occurred while processing the callback: %s") % error_message)
            response_data = {'status': 'error', 'message': error_message}
            return Response(json.dumps(response_data), content_type='application/json', status=500)
