# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common
from odoo.modules.module import get_module_resource


class HrRecruitmentTestCase(common.TransactionCase):

    def setUp(self):
        super(HrRecruitmentTestCase, self).setUp()
        self.User = self.env['res.users']
        self.Mail = self.env['mail.thread']
        self.HR = self.env['hr.applicant']
        self.company_id = self.ref('base.main_company')
        self.group_hr_recruitment_user = self.ref('hr_recruitment.group_hr_recruitment_user')
        self.job_id = self.ref('hr.job_developer')
        self.job_stage = self.ref('hr_recruitment.stage_job1')

    def test_00_res_users_hr_recruitment_officer_flow(self):
        self.res_users_hr_recruitment_officer = self.User.with_context({'res_users_hr_recruitment_officer': True}).create({
            'company_id': self.company_id,
            'name': 'HR Recruitment Officer',
            'login': "hrro",
            'email': "hrofcr@yourcompany.com",
            'groups_id': [(6, 0, [self.group_hr_recruitment_user])]
        })

        request_file = open(get_module_resource('hr_recruitment','test', 'resume.eml'),'rb')
        request_message = request_file.read()
        self.Mail.sudo(self.res_users_hr_recruitment_officer.id).message_process('hr.applicant', request_message, custom_values={"job_id": self.job_id})

        applicant = self.HR.search([('email_from', '=', 'Mr. Richard Anderson <Richard_Anderson@yahoo.com>')])[0]
        self.assertTrue(applicant, "Applicant is not created after getting the mail")
        resume_ids = self.env['ir.attachment'].search([('datas_fname','=','resume.pdf'),('res_model','=',self.HR._name), ('res_id','=', applicant.id)])
        self.assertEquals(applicant.name, 'Application for the post of Jr.application Programmer.', 'Applicant name does not match.')
        self.assertEquals(applicant.stage_id.id, self.job_stage, "Stage should be 'Initial qualification' and is '%s'." % (applicant.stage_id.name))
        self.assertEquals(applicant.stage_id.sequence, 1, 'Applicant stage sequence should be 1.')
        self.assertTrue(len(resume_ids), 'Resume is not attached.')

        applicant.write({'job_id':self.job_id})
        applicant.action_makeMeeting()
