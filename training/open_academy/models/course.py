from datetime import datetime
from openerp import _, api, fields, models

class Course(models.Model):
	_inherit = "mail.thread"
	_name = "course.course"

	def _get_duration(self):
		return 50

	name = fields.Char()
	responsible = fields.Many2one("res.users")
	session_ids = fields.One2many("session.session", "course_id", string="Sessions")
	description = fields.Text()
	start_date = fields.Datetime()
	end_date = fields.Datetime()
	duration = fields.Float(compute="_get_duration")
