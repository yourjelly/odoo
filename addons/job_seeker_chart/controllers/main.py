from odoo import http
from odoo.http import request
from itertools import groupby


class ApplyForJob(http.Controller):

    @http.route(['/prefill_data'], type='json', auth="public")
    def prefill_data(self):
        city_list = request.env['hr.applicant'].search([]).mapped('partner_id.city')
        job_profile_list = request.env['hr.job'].search([]).mapped('name')
        return {"city": sorted(city_list), "job_profile": job_profile_list}


    @http.route(['/create_graph'], type='json', auth="public")
    def job_search(self, search_term, search_by_location=False):
        count = {}
        if search_by_location:
            # read_group() because we can directly count the group by job_id
            Candidates = request.env['hr.applicant'].read_group([('partner_id.city', '=', search_term)], ['job_id'], ['job_id'])
            for i in Candidates:
                count[request.env['hr.job'].browse(i['job_id'][0]).name] = i['job_id_count']
        else:
            Candidates = request.env['hr.applicant'].search([('job_id.name', '=', search_term)])
            # groupby() because we've to count the group by partner_id.city
            for name, cities in groupby(Candidates, lambda i: i.partner_id.city):
                count[name] = len(request.env['hr.applicant'].concat(*cities))
        return count
