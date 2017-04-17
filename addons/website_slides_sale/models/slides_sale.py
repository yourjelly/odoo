# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _

class Course(models.Model):
	_name = "slide.channel"
	_inherit = ['slide.channel', 'rating.mixin']

	is_course = fields.Boolean("Is Course") # To identify whether it is normal channel or used as a course
	course_html = fields.Html("Course Details", help="This will be displayed on Course Details page, user can design it.")
	language = fields.Many2one("res.lang", "Language")
	instructor_ids = fields.Many2many("res.partner", string="Instructors")
	product_id = fields.Many2one("product.template", "Product")
	course_price = fields.Float(related="product_id.list_price", string="Course Price")

class Lecture(models.Model):
	_inherit = "slide.slide"

	attendee_ids = fields.Many2many("res.partner", "Attendees")
	# TODO: we can use Download Security field for this OR download security is used for security and this gonna be used for showing slide type(icons)
	slide_type = fields.Selection([('preview', 'Preview'), ('free', 'Free')], string="Slide Type")


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

	def _get_total_viewed_slides(self):
		return 0

	name = fields.Char()
	partner_id = fields.Many2one("res.partner", string="Customer")
	course_id = fields.Many2one("slide.channel", string="Course")
	course_start_date = fields.Date("Course Start Date")
	course_end_date = fields.Date("Course End Date")
	last_view = fields.Many2one("slide.slide", string="Last View", readonly=True)
	viewed_slide_ids = fields.Many2many("slide.slide", string="Viewed Lectures")
	viewed_slides = fields.Integer(compute="_get_total_viewed_slides", string="Total Viewed Lectures")
