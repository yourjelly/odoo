# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class Channel(models.Model):
	_inherit = "slide.channel"

	is_course = fields.Boolean("Is Course") # To identify whether it is normal channel or used as a course


class Course(models.Model):
	_name = "course.course"
	_inherits = {'slide.channel': 'channel_id'}
	_inherit = ['rating.mixin', 'mail.thread', 'website.seo.metadata', 'website.published.mixin']

	course_subtitle = fields.Char(string="Course Subtitle")
	course_html = fields.Html("Course Details", help="This will be displayed on Course Details page, user can design it.")
	language = fields.Many2one("res.lang", "Language")
	instructor_ids = fields.Many2many("res.partner", string="Instructors")
	product_id = fields.Many2one("product.template", "Product")
	course_price = fields.Float(related="product_id.list_price", string="Course Price")
	channel_id = fields.Many2one('slide.channel', 'Channel',
        auto_join=True, index=True, ondelete="cascade", required=True)
	user_id = fields.Many2one("res.users", "Posted User", default=lambda self: self.env.user.id)
	lecture_ids = fields.One2many('course.lecture', 'course_id', string="Slides")


class Lecture(models.Model):
	_name = "course.lecture"
	_inherits = {'slide.slide': 'slide_id'}
	_inherit = ['mail.thread', 'website.seo.metadata', 'website.published.mixin']

	# attendee_ids = fields.Many2many("res.partner", "Attendees")
	# TODO: we can use Download Security field for this OR download security is used for security and this gonna be used for showing slide type(icons)
	slide_view_type = fields.Selection([('preview', 'Preview'), ('free', 'Free')], string="Slide Type")
	slide_id = fields.Many2one('slide.slide', 'Slide',
        auto_join=True, index=True, ondelete="cascade", required=True)
	is_course_slide = fields.Boolean(related="slide_id.channel_id.is_course", string="Is Course Lecture")
	course_id = fields.Many2one("course.course", string="Course", required=True, ondelete='cascade')

	@api.model
	def create(self, vals):
		if not vals.get('course_id'):
			raise UserError(_("Lecture must be linked with Course"))
		course = self.env['course.course'].browse(vals['course_id']) # Maybe Use Exist
		vals['channel_id'] = course.channel_id.id
		return super(Lecture, self).create(vals)


class LectureAttendee(models.Model):
	_name = 'lecture.attendee'

	name = fields.Char()
	partner_id = fields.Many2one("res.partner", "Attendee")
	slide_id = fields.Many2one("course.lecture")
	date_view = fields.Datetime("View Date")

	@api.onchange("partner_id")
	def _onchange_partner(self):
		if self.partner_id:
			contact_id = self.partner_id.address_get().get('contact', False)
			if contact_id:
				contact = self.env['res.partner'].browse(contact_id)
				self.name = contact.name or self.name
		else:
			self.name = Falses


class Instructor(models.Model):
	_inherit = "res.partner"

	def _get_total_numbers(self):
		return

	about_details = fields.Text("About")
	total_course = fields.Integer(compute="_get_total_numbers")
	total_subscribers = fields.Integer(compute="_get_total_numbers")
	total_reviews = fields.Integer(compute="_get_total_numbers")


class ProductTemplate(models.Model):
	_inherit = "product.template"

	is_course = fields.Boolean(string="Course Product", help='Determine if a product is '
      'course product or not.')


class CourseRegistration(models.Model):
	_name = "course.registration"

	def _get_last_view_slide(self):
		return 1

	def _get_total_viewed_slides(self):
		return 0

	name = fields.Char()
	partner_id = fields.Many2one("res.partner", string="Customer")
	course_id = fields.Many2one("slide.channel", string="Course")
	course_start_date = fields.Date("Course Start Date")
	course_end_date = fields.Date("Course End Date")
	# last_view = fields.Many2one("slide.slide", string="Last View", readonly=True)
	last_view = fields.Many2one(compute="_get_last_view_slide", relation="course.lecture", string="Last View", readonly=True)
	# viewed_slide_ids = fields.Many2many("slide.slide", string="Viewed Lectures")
	viewed_slides = fields.Integer(compute="_get_total_viewed_slides", string="Total Viewed Lectures")
