# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime
import werkzeug.exceptions
import werkzeug.urls
import werkzeug.wrappers
import json
import lxml
from urllib2 import urlopen, URLError
import base64

import openerp
from openerp import tools, _
from openerp.addons.web import http
from openerp.addons.web.controllers.main import binary_content
from openerp.addons.web.http import request
from openerp.addons.website.models.website import slug


class WebsiteRecruitmentt(http.Controller):

    # Job
    # --------------------------------------------------

    @http.route(['/jobs/new'], type='http', auth="public", website=True)
    def create_job(self, **kwargs):
        jobs = request.env['hr.job']
        return request.website.render("website_recruitment.recruitment_all")

    # to save record
    @http.route('/jobs/publish', type='http', auth="public", website=True)
    def add_job(self, **kwargs):
        job = request.env['hr.job']
        vals = {
        'skill_ids' : kwargs.get('skill_ids'),
        'name' : kwargs.get('name'),
        'what_we_offer' : kwargs.get('what_we_offer'),
        'responsibilities' : kwargs.get('responsibilities'),
        'nice_to_have' : kwargs.get('nice_to_have'),
        'must_have' : kwargs.get('must_have'),
        }
        job = job.create(vals)
        return request.redirect("/jobs/detail/%s?enable_editor=1" % slug(job))





