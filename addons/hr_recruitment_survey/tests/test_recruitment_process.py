from odoo.tests.common import TransactionCase


class TestRecruitmentProcess(TransactionCase):
    def setUp(self):
        super(TestRecruitmentProcess, self).setUp()
        self.HrApplicant = self.env['hr.applicant']
        self.HrRecruitment = self.env.ref('hr_recruitment.hr_case_programmer')

    def test_hr_action_print_survey(self):
            self.HrRecruitment.action_print_survey()
