from openerp import _, api, fields, models

class Session(models.Model):
	_name = "session.session"

	name = fields.Char()
	course_id = fields.Many2one("course.course")
	instructor_id = fields.Many2one("res.partner")
	