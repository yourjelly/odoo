from odoo import models, api
import requests
import logging

_logger = logging.getLogger(__name__)

class HrRecruitmentLinkedIn(models.AbstractModel):
    _name = 'hr.recruitment.linkedin'
    _description = 'HR Recruitment LinkedIn Integration'

    @api.model
    def generate_access_token(self):
        linkedin_api_token = self.env['ir.config_parameter'].sudo().get_param('hr_recruitment_linkedin.linkedin_api_token')
        linkedin_secret_key = self.env['ir.config_parameter'].sudo().get_param('hr_recruitment_linkedin.linkedin_secret_key')

        access_token_url = 'https://www.linkedin.com/oauth/v2/accessToken'
        payload = {
            'grant_type': 'client_credentials',
            'client_id': linkedin_api_token,
            'client_secret': linkedin_secret_key
        }

        headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        }

        response = requests.post(access_token_url, headers=headers, data=payload)
        if response.status_code == 200:
            access_token = response.json().get('access_token')
            return access_token
        else:
            return None

    @api.model
    def make_api_request(self, payload=None, method='GET'):
        access_token = self.generate_access_token()
        if access_token:
            headers = {'Authorization': f'Bearer {access_token}'}
            api_url = f'https://api.linkedin.com/v2/simpleJobPostings'

            if method == 'GET':
                response = requests.get(api_url, headers=headers)
            elif method == 'POST':
                headers['X-Restli-Method'] = 'batch_create'
                response = requests.post(api_url, headers=headers, json=payload)

            if response.status_code == 200:
                api_data = response.json()
                return api_data
            else:
                return None
        else:
            return None

    @api.model
    def post_job_to_linkedin(self, job_data):
        payload = {
            'elements': [job_data]
        }
        response = self.make_api_request(payload, method='POST')
        return response

    @api.model
    def prepare_job_data(self, job):
        company = job.company_id

        job_data = {
            "integrationContext": "urn:li:organization:YOUR_ORG_ID",
            "companyApplyUrl": f"http://{company.website}/jobs/detail/{job.name}-{job.id}?trk=LinkedIn",
            "externalJobPostingId": str(job.id),
            "jobPostingOperationType": "CREATE",
            "title": job.name,
            "description": job.description,
            "listedAt": int(job.create_date.timestamp()),
            "location": f"{company.city}, {company.state_id.name}",
            "countryCode": str(company.country_id.code),
            "posterEmail": job.company_id.email,
        }
        return job_data

    @api.model
    def post_jobs_to_linkedin(self):
        jobs = self.env['hr.job'].sudo().search([('is_published', '=', True)], limit=5)
        if jobs:
            for job in jobs:
                job_data = self.prepare_job_data(job)
                response = self.post_job_to_linkedin(job_data)
                if response:
                    _logger.info(f"Job '{job.name}' posted to LinkedIn successfully.")
                else:
                    _logger.error(f"Failed to post job '{job.name}' to LinkedIn.")
        else:
            _logger.warning("No jobs found to post.")

        return True
