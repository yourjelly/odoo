# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import http, _
from urllib.parse import quote
from odoo.http import request, content_disposition
from odoo.tools import html2plaintext
from markupsafe import Markup

_logger = logging.getLogger(__name__)

class HrIndeedRecruitment(http.Controller):
    def _prepare_indeed_apply_data(self, jobs):
        """ Prepare data for Indeed Apply XML feed.

        :param jobs: List of hr.job records
        :return: List of job feed data
        """
        indeed_api_token = request.env['ir.config_parameter'].sudo().get_param('hr_recruitment_indeed.indeed_api_token')
        job_feed_data = []

        for job in jobs:
            # Extract relevant job data
            job_name = job.name.lower().replace(" ", "-")
            indeed_job_url = quote(f"{request.env.user.get_base_url()}/jobs/detail/{job_name}-{job.id}").replace('/', '%2F')
            create_date_gmt = job.create_date.strftime("%Y-%m-%dT%H:%M:%SZ")
            job_description = html2plaintext(job.website_description)

            # Construct Indeed Apply data
            data = 'indeed-apply-apiToken=%s&indeed-apply-jobTitle=%s&indeed-apply-jobId=%s&indeed-apply-jobCompanyName=%s&indeed-apply-jobLocation=%s&indeed-apply-jobUrl=%s&indeed-apply-posturl=%s' % (
                indeed_api_token,
                job.name,
                job.id,
                job.company_id.name,
                job.company_id.street,
                indeed_job_url,
                quote(f"{request.env.user.get_base_url()}/jobs").replace('/', '%2F')
            )

            # Append job data to feed list
            job_feed_data.append({
                'title': Markup(f"<![CDATA[{job.name}]]>"),
                'date': Markup(f"<![CDATA[{create_date_gmt}]]>"),
                'referencenumber': Markup(f"<![CDATA[{job.id}]]>"),
                'requisitionid': Markup(f"<![CDATA[{job.id}]]>"),
                'url': Markup(f"<![CDATA[{job.company_id.website}/jobs/detail/{job_name}-{job.id}?source=Indeed]]>"),
                'company': Markup(f"<![CDATA[{job.company_id.name}]]>"),
                'salary': Markup(f"<![CDATA[{job.salary}]]>"),
                'city': Markup(f"<![CDATA[{job.company_id.city}]]>"),
                'state': Markup(f"<![CDATA[{job.company_id.state_id.name}]]>"),
                'country': Markup(f"<![CDATA[{job.company_id.country_id.name}]]>"),
                'postalcode': Markup(f"<![CDATA[{job.company_id.zip}]]>"),
                'streetaddress': Markup(f"<![CDATA[{job.company_id.street}]]>"),
                'email': Markup(f"<![CDATA[{job.company_id.email}]]>"),
                'description': Markup(f"<![CDATA[{job_description}]]>"),
                'jobtype': Markup(f"<![CDATA[{job.contract_type_id.name}]]>"),
                'indeed-apply-data': Markup(f"<![CDATA[{data}]]>")
            })

        return job_feed_data

    @http.route('/jobs/feed.xml', type='http', auth="public", website=True, sitemap=False)
    def job_feed(self):
        """ Generate and provide the Indeed Apply XML feed.

        :return: XML feed response
        """
        jobs = request.env['hr.job'].sudo().search([('is_published', '=', True)], limit=5)
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
