# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import http, _
from odoo.addons.http_routing.models.ir_http import slug
from odoo.http import request
from odoo.tools.misc import groupby
from werkzeug.exceptions import NotFound


class WebsiteHrRecruitment(http.Controller):
    def sitemap_jobs(env, rule, qs):
        if not qs or qs.lower() in '/jobs':
            yield {'loc': '/jobs'}

    @http.route([
        '/jobs',
        '/jobs/country/<model("res.country"):country>',
        '/jobs/country/<model("res.country"):country>/page/<int:page>',
        '/jobs/department/other',
        '/jobs/department/other/page/<int:page>',
        '/jobs/department/<model("hr.department"):department>',
        '/jobs/department/<model("hr.department"):department>/page/<int:page>',
        '/jobs/country/<model("res.country"):country>/department/other',
        '/jobs/country/<model("res.country"):country>/department/other/page/<int:page>',
        '/jobs/country/<model("res.country"):country>/department/<model("hr.department"):department>',
        '/jobs/country/<model("res.country"):country>/department/<model("hr.department"):department>/page/<int:page>',
        '/jobs/office/<int:office_id>',
        '/jobs/office/<int:office_id>/page/<int:page>',
        '/jobs/country/<model("res.country"):country>/office/<int:office_id>',
        '/jobs/country/<model("res.country"):country>/office/<int:office_id>/page/<int:page>',
        '/jobs/department/other/office/<int:office_id>',
        '/jobs/department/other/office/<int:office_id>/page/<int:page>',
        '/jobs/department/<model("hr.department"):department>/office/<int:office_id>',
        '/jobs/department/<model("hr.department"):department>/office/<int:office_id>/page/<int:page>',
        '/jobs/country/<model("res.country"):country>/department/other/office/<int:office_id>',
        '/jobs/country/<model("res.country"):country>/department/other/office/<int:office_id>/page/<int:page>',
        '/jobs/country/<model("res.country"):country>/department/<model("hr.department"):department>/office/<int:office_id>',
        '/jobs/country/<model("res.country"):country>/department/<model("hr.department"):department>/office/<int:office_id>/page/<int:page>',
        '/jobs/remote',
        '/jobs/remote/page/<int:page>',
        '/jobs/remote/department/other',
        '/jobs/remote/department/other/page/<int:page>',
        '/jobs/remote/department/<model("hr.department"):department>',
        '/jobs/remote/department/<model("hr.department"):department>/page/<int:page>',
    ], type='http', auth="public", website=True, sitemap=sitemap_jobs)
    def jobs(self, country=None, department=None, office_id=None, **kwargs):
        env = request.env(context=dict(request.env.context, show_address=True, no_tag_br=True))

        Country = env['res.country']
        Jobs = env['hr.job']

        is_remote = 'remote' in request.httprequest.path.split('/')
        is_other_department = '/department/other' in request.httprequest.path and not department

        # Default search by user country
        if not (country or department or office_id or kwargs.get('all_countries')):
            country_code = request.geoip.get('country_code')
            if country_code:
                countries_ = Country.search([('code', '=', country_code)])
                country = countries_[0] if countries_ else None
                if not any(j for j in jobs if j.address_id and j.address_id.country_id == country):
                    country = False

        options = {
            'displayDescription': True,
            'allowFuzzy': not request.params.get('noFuzzy'),
            'country': str(country.id) if country else None,
            'department': str(department.id) if department else None,
            'office_id': office_id,
            'is_remote': is_remote,
            'is_other_department': is_other_department,
        }
        total, details, fuzzy_search_term = request.website._search_with_fuzzy("jobs", search,
            limit=1000, order="is_published desc, sequence, no_of_recruitment desc", options=options)
        # Browse jobs as superuser, because address is restricted
        jobs = details[0].get('results', Jobs).sudo()

        # Deduce offices, departments and countries offices of those jobs
        def sort(items, key):
            """ Sort items alphabetically followed by None if present

            :param set items: set of model ids and None
            :param str key: field on which to sort
            :return: sorted list of items
            """
            has_special = None in items
            if has_special:
                items.remove(None)
            items = list(items)
            items.sort(key=lambda item: item[key] or '')
            if has_special:
                items.append(None)
            return items

        offices = sort(set(j.address_id or None for j in jobs), 'city')
        departments = sort(set(j.department_id or None for j in jobs), 'name')
        countries = sort(set(o and o.country_id or None for o in offices), 'name')

        total = len(jobs)

        count_per_country = {'all': total}
        for c, jobs_list in groupby(jobs, lambda job: job.address_id.country_id):
            count_per_country[c] = len(jobs_list)
        count_per_department = {'all': total}
        for d, jobs_list in groupby(jobs, lambda job: job.department_id):
            count_per_department[d] = len(jobs_list)
        count_other_department = len(jobs.filtered(lambda job: not job.department_id))
        if count_other_department:
            count_per_department[None] = count_other_department
        count_per_office = {'all': total}
        for o, jobs_list in groupby(jobs, lambda job: job.address_id):
            count_per_office[o] = len(jobs_list)
        count_remote = len(jobs.filtered(lambda job: not job.address_id))
        if count_remote:
            count_per_country[None] = count_remote
            count_per_office[None] = count_remote

        pager = request.website.pager(
            url=request.httprequest.path.partition('/page/')[0],
            url_args={'search': search},
            total=total,
            page=page,
            step=self._jobs_per_page,
        )
        offset = pager['offset']
        jobs = jobs[offset:offset + self._jobs_per_page]

        office = env['res.partner'].browse(office_id) if office_id else None

        # Render page
        return request.render("website_hr_recruitment.index", {
            'jobs': jobs,
            'countries': countries,
            'departments': departments,
            'offices': offices,
            'country_id': country,
            'department_id': department,
            'office_id': office,
            'is_remote': is_remote,
            'is_other_department': is_other_department,
            'pager': pager,
            'search': fuzzy_search_term or search,
            'search_count': total,
            'original_search': fuzzy_search_term and search,
            'count_per_country': count_per_country,
            'count_per_department': count_per_department,
            'count_per_office': count_per_office,
        })

    @http.route('/jobs/add', type='http', auth="user", website=True)
    def jobs_add(self, **kwargs):
        # avoid branding of website_description by setting rendering_bundle in context
        job = request.env['hr.job'].with_context(rendering_bundle=True).create({
            'name': _('Job Title'),
        })
        return request.redirect(request.env["website"].get_client_action_url(f"/jobs/detail/{slug(job)}", True))

    @http.route('''/jobs/detail/<model("hr.job"):job>''', type='http', auth="public", website=True, sitemap=True)
    def jobs_detail(self, job, **kwargs):
        return request.render("website_hr_recruitment.detail", {
            'job': job,
            'main_object': job,
        })

    @http.route('''/jobs/apply/<model("hr.job"):job>''', type='http', auth="public", website=True, sitemap=True)
    def jobs_apply(self, job, **kwargs):
        error = {}
        default = {}
        if 'website_hr_recruitment_error' in request.session:
            error = request.session.pop('website_hr_recruitment_error')
            default = request.session.pop('website_hr_recruitment_default')
        return request.render("website_hr_recruitment.apply", {
            'job': job,
            'error': error,
            'default': default,
        })
