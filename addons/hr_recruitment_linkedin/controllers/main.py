# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import http, _
from urllib.parse import quote
from odoo.http import request, content_disposition
from odoo.tools import html2plaintext
from markupsafe import Markup

_logger = logging.getLogger(__name__)

class HrLinkedinRecruitment(http.Controller):
    def _prepare_linkedin_apply_data(self, jobs):
        """ Prepare data for Linkedin Apply XML feed.
        :param jobs: List of hr.job records
        :return: List of job feed data
        """
        job_feed_data = []

        for job in jobs:
            # Extract relevant job data
            job_name = job.name.lower().replace(" ", "-")
            job_description = html2plaintext(job.description)

            # Append job data to feed list
            job_feed_data.append({
                'partnerJobId': Markup(f"<![CDATA[{job.id}]]>"),
                'company': Markup(f"<![CDATA[{job.company_id.name}]]>"),
                'title': Markup(f"<![CDATA[{job.name}]]>"),
                'description': Markup(f"<![CDATA[{job_description}]]>"),
                'applyUrl': Markup(f"<![CDATA[{job.company_id.website}/jobs/detail/{job_name}-{job.id}?trk=linkedin]]>"),
                'companyId': Markup(f"<![CDATA[{job.id}]]>"), 
                'location': Markup(f"<![CDATA[{job.company_id.street}]]>"),
                'city': Markup(f"<![CDATA[{job.company_id.city}]]>"),
                'state': Markup(f"<![CDATA[{job.company_id.state_id.name}]]>"),
                'country': Markup(f"<![CDATA[{job.company_id.country_id.code}]]>"),
                'jobtype': Markup(f"<![CDATA[{job.contract_type_id.name}]]>"),
            })

        return job_feed_data

    @http.route('/jobs/feed.xml', type='http', auth="public", website=True, sitemap=False)
    def job_feed(self):
        """ Generate and provide the Linkedin Apply XML feed.
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

        template_vals = self._prepare_linkedin_apply_data(jobs)

        content = request.env['ir.qweb']._render('hr_recruitment_linkedin.job_feed', {'data': template_vals})
        content_with_source = """<?xml version="1.0" encoding="utf-8"?>
<source>%s</source>"""%(content)
        return request.make_response(
            content_with_source,
            headers=[
                ('Content-Type', 'text/xml'),
                ('Content-Disposition', content_disposition("job_data.xml"))
            ]
        )