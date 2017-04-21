# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import http, _
from odoo.exceptions import AccessError, UserError
from odoo.http import request
from odoo.addons.website.models.website import slug
from odoo.addons.website_portal.controllers.main import website_account, get_records_pager


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

	@http.route(['/course/learn/<model("course.course"):course>'], type='http', auth="public", website=True)
	def my_course_open(self, course=None, category=None, slide_type=None, **kw): # TODO: We will not have slide_type and  category so remove it and improve method
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
					'lectures': Lecture.search(category['__domain'], limit=4, offset=0, order=order), # TODO: Order by
				})
			values.update({
				'category_datas': category_datas,
				'current_lecture': Lecture.search([], limit=1, offset=0),
			})
		return request.render('website_slides_sale.my_course_details', values)


	@http.route(['/course/manage/<model("course.course"):course>'], type='http', auth="user", website=True)
	def course_new(self, course=None, **post):
		languages = request.env['res.lang'].search([])
		values = {
			'course': course,
			'user': request.env.user,
			'languages': languages
		}
		return request.render('website_slides_sale.course_new_form', values)


	@http.route(['/shop/add_course'], type='http', auth="user", methods=['POST'], website=True)
	def add_course(self, name=None, category=0, **post):
		course = request.env['course.course'].create({
			'name': name or _("New Course"),
		})

		return request.redirect("/course/manage/%s" % slug(course))

	@http.route(['/course/dashboard'], type='http', auth='user', website=True)
	def instructor_course_dashboard(self, **kw):
		Course = request.env['course.course']
		courses = Course.search([('user_id', '=', request.env.user.id)])
		return request.render('website_slides_sale.course_instructor_dashboard', {'courses': courses})


class WebsiteAccount(website_account):

	def _prepare_portal_layout_values(self):
		Course = request.env['course.course']
		values = super(WebsiteAccount, self)._prepare_portal_layout_values()
		partner = request.env.user.partner_id
		course_count = Course.search_count([
			('message_partner_ids', 'child_of', [partner.commercial_partner_id.id])
		])
		values.update({
			'course_count': course_count,
		})
		return values

	@http.route(['/my/courses', '/my/courses/page/<int:page>'], type='http', auth="user", website=True)
	def portal_my_courses(self, page=1, date_begin=None, date_end=None, sortby=None, **kw):
		Course = request.env['course.course']
		values = self._prepare_portal_layout_values()
		partner = request.env.user.partner_id

		domain = [
			('message_partner_ids', 'child_of', [partner.commercial_partner_id.id]),
		]

		searchbar_sortings = {
			'name': {'label': _('Name'), 'order': 'name asc'},
			'course_price': {'label': _('Price'), 'order': 'course_price'},
		}
		# default sortby order
		if not sortby:
			sortby = 'name'
		sort_order = searchbar_sortings[sortby]['order']

		archive_groups = self._get_archive_groups('course.course', domain)
		if date_begin and date_end:
			domain += [('create_date', '>', date_begin), ('create_date', '<=', date_end)]

		# count for pager
		course_count = Course.search_count(domain)
		print "\n\ncourse_count ::: ", course_count
		# pager
		pager = request.website.pager(
			url="/my/courses",
			url_args={'date_begin': date_begin, 'date_end': date_end, 'sortby': sortby},
			total=course_count,
			page=page,
			step=self._items_per_page
		)
		# content according to pager and archive selected
		courses = Course.search(domain, order=sort_order, limit=self._items_per_page, offset=pager['offset'])
		print "\n\ncourses and domain are ::: ", courses, domain
		request.session['my_orders_history'] = courses.ids[:100]

		values.update({
			'date': date_begin,
			'courses': courses.sudo(),
			'page_name': 'courses',
			'pager': pager,
			'archive_groups': archive_groups,
			'default_url': '/my/courses',
			'searchbar_sortings': searchbar_sortings,
			'sortby': sortby,
		})
		return request.render("website_slides_sale.portal_my_courses", values)
