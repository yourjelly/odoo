from openerp import http
from openerp.http import request

class OpenAcademy(http.Controller):

	@http.route("/openacademy/hello", type="http", methods=["POST", "GET"], auth="public", website=True)
	def say_hello(self, blog_name=None, **kw):
		return request.website.render("open_academy.simple_page", {'message': "Hello MSH"})

	@http.route("/opn_academy/course", type="http", methods=["GET"], auth="public", website=True)
	def course_list(self):
		courses = request.env['course.course'].sudo().search([]).read(['id', 'name', 'description'])
		courses_group = []
		group_to_add = []
		print "\n\ncourses ::: ", courses
		for index, course in enumerate(courses):
			if index % 4 == 3 and group_to_add:
				group_to_add.append(course)
				courses_group.append(group_to_add)
				group_to_add = []
			else:
				group_to_add.append(course)
		if group_to_add:
			courses_group.append(group_to_add)
		return request.website.render("open_academy.courses", {'courses': courses_group})
