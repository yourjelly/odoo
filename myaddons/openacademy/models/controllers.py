# -*- coding: utf-8 -*- 
from odoo import models, api, fields, http

class OA_Controller(http.Controller):
    @http.route('/OpenAcademy/', auth='public', website=True)
    def index(self, **kw):
        Teachers = http.request.env['res.partner'].search([('isTeacher','=',True)])
        return http.request.render('openacademy.index', {
            'teachers': Teachers,
        })

    @http.route('/OpenAcademy/<int:id>/', auth='public', website=True)
    def teacher(self, id):
        # Teachers = http.request.env['res.partner'].search(
        #     [('isTeacher','=',True), ('name','ilike',name)], limit=1)
        Teachers = http.request.env['res.partner'].search(
            [('isTeacher','=',True), ('id','=',id)])
        return http.request.render('openacademy.teacher', {
            'teachers': Teachers,
        })

    @http.route('/OpenAcademy/Person/<model("res.partner"):person>/', auth='public', website=True)
    def test(self, person):
        return http.request.render('openacademy.person', {
            'person': person
        })