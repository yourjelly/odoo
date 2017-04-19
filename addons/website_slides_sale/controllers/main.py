# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import http, _
from odoo.exceptions import AccessError, UserError
from odoo.http import request

_logger = logging.getLogger(__name__)


class WebsiteSlidesSale(http.Controller):
	_course_per_page = 12
	_course_per_list = 20
	_slides_per_page = 12
	_slides_per_list = 20
	_order_by_criterion = {
        'date': 'date_published desc',
        'view': 'total_views desc',
        'vote': 'likes desc',
	}

	@http.route([
		'/courses',
		'/courses/page/<int:page>',
		'/courses/category/<model("slide.category"):category>',
		'/courses/category/<model("slide.category"):category>/page/<int:page>'],
		type='http', auth="public", website=True)
	def courses_index(self, search='', category=None, page=1, **post):
		""" Returns a list of available channels: if only one is available,
			redirects directly to its slides
		"""
		Lectures = request.env['course.lecture']
		pager_url = "/courses"
		pager_args = {}
		domain = []
		if search:
			domain += [('name', 'ilike', search)]
			pager_args['search'] = search
		if category:
			domain += [('category_id', '=', category.id)]
			pager_url += "/category/%s" % category.id

		pager_count = Lectures.search_count(domain)
		pager = request.website.pager(url=pager_url, total=pager_count, page=page,
                                      step=self._course_per_page, scope=self._course_per_page,
                                      url_args=pager_args)

		courses = request.env['course.course'].search(domain)
		print "\n\ndomain ::: ", domain, courses
		if not courses:
			return request.render("website_slides_sale.course_not_found")
		return request.render('website_slides_sale.courses', {
            'courses': courses,
            'pager': pager,
            'user': request.env.user,
            'is_public_user': request.env.user == request.website.user_id
        })

	@http.route([
        '''/courses/<model("course.course", "[('can_see', '=', True)]"):course>''',
        '''/courses/<model("course.course", "[('can_see', '=', True)]"):course>/page/<int:page>''',

        # '''/courses/<model("course.course", "[('can_see', '=', True)]"):course>/<string:slide_type>''',
        # '''/courses/<model("course.course", "[('can_see', '=', True)]"):course>/<string:slide_type>/page/<int:page>''',

        # '''/courses/<model("course.course", "[('can_see', '=', True)]"):course>/tag/<model("slide.tag"):tag>''',
        # '''/courses/<model("course.course", "[('can_see', '=', True)]"):course>/tag/<model("slide.tag"):tag>/page/<int:page>''',

        # '''/courses/<model("course.course", "[('can_see', '=', True)]"):course>/category/<model("slide.category"):category>''',
        # '''/courses/<model("course.course", "[('can_see', '=', True)]"):course>/category/<model("slide.category"):category>/page/<int:page>''',

        # '''/courses/<model("course.course", "[('can_see', '=', True)]"):course>/category/<model("slide.category"):category>/<string:slide_type>''',
        # '''/courses/<model("course.course", "[('can_see', '=', True)]"):course>/category/<model("slide.category"):category>/<string:slide_type>/page/<int:page>'''
        ], type='http', auth="public", website=True)
	def course(self, course, category=None, tag=None, page=1, slide_type=None, sorting='creation', search=None, **kw):
		Lecture = request.env['course.lecture']
		user = request.env.user
		values = {
			'course': course,
			'user': user,
			'is_public_user': user == request.website.user_id,
			#'display_channel_settings': not request.httprequest.cookies.get('slides_channel_%s' % (channel.id), False) and channel.can_see_full,
		}

		# Display uncategorized slides
		if not slide_type and not category:
			category_datas = []
			domain = [
				'|',
				('name', 'ilike', course.name),
				('description', 'ilike', course.description)]
			for category in Lecture.read_group(domain, ['category_id'], ['category_id']):
				category_id, name = category.get('category_id') or (False, _('Uncategorized'))
				category_datas.append({
					'id': category_id,
					'name': name,
					'total': category['category_id_count'],
					'lectures': Lecture.search(category['__domain'], limit=4, offset=0, order=order)
				})
			values.update({
				'category_datas': category_datas,
			})
		return request.render('website_slides_sale.course_details', values)