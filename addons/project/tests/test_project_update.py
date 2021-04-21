# -*- coding: utf-8 -*-

from dateutil.relativedelta import relativedelta

from odoo import fields
from odoo.addons.mail.tests.common import mail_new_test_user
from odoo.addons.project.tests.test_project_base import TestProjectCommon
from odoo.exceptions import AccessError
from odoo.tests import HttpCase, tagged
from odoo.tests.common import Form, users

@tagged('-at_install', 'post_install')
class TestProjectUpdateAccessRights(TestProjectCommon):
    @classmethod
    def setUpClass(cls):
        super(TestProjectUpdateAccessRights, cls).setUpClass()
        cls.project_update_1 = cls.env['project.update'].create({
            'name': "Test Project Update",
            'project_id': cls.project_pigs.id,
            'status_id': cls.env.ref('project.project_update_status_on_track').id
        })

    def setUp(self):
        super().setUp()
        self.base_user = mail_new_test_user(self.env, 'Base user', groups='base.group_user')
        self.project_user = mail_new_test_user(self.env, 'Project user', groups='project.group_project_user')
        self.project_manager = mail_new_test_user(self.env, 'Project admin', groups='project.group_project_manager')

    @users('Project user', 'Project admin', 'Base user')
    def test_project_update_user_can_read(self):
        self.project_update_1.with_user(self.env.user).name

    @users('Project user', 'Base user')
    def test_project_update_user_no_write(self):
        with self.assertRaises(AccessError, msg="%s should not be able to write in the project update" % self.env.user.name):
            self.project_update_1.with_user(self.env.user).name = "Test write"

    @users('Project admin')
    def test_project_update_admin_can_write(self):
        self.project_update_1.with_user(self.env.user).name = "Test write"

    @users('Project user')
    def test_project_update_user_project_owner_can_write(self):
        self.project_pigs.user_id = self.env.user
        self.project_update_1.with_user(self.env.user).name = "Test write"

    @users('Project user', 'Base user')
    def test_project_update_user_no_unlink(self):
        with self.assertRaises(AccessError, msg="%s should not be able to unlink in the project update" % self.env.user.name):
            self.project_update_1.with_user(self.env.user).unlink()

    @users('Project admin')
    def test_project_update_admin_unlink(self):
        self.project_update_1.with_user(self.env.user).unlink()

    @users('Project user')
    def test_project_update_user_project_owner_no_unlink(self):
        self.project_pigs.user_id = self.env.user
        with self.assertRaises(AccessError, msg="%s should not be able to unlink the project update even if project owner" % self.env.user.name):
            self.project_update_1.with_user(self.env.user).unlink()


@tagged('-at_install', 'post_install')
class TestProjectUpdate(TestProjectCommon):
    @classmethod
    def setUpClass(cls):
        super(TestProjectUpdate, cls).setUpClass()

        cls.project_update_1 = cls.env['project.update'].create({
            'name': "Test Project Update",
            'project_id': cls.project_pigs.id,
            'status_id': cls.env.ref('project.project_update_status_on_track').id
        })

    def test_project_update_form(self):
        with Form(self.env['project.milestone'].with_context({'default_project_id': self.project_pigs.id})) as milestone_form:
            milestone_form.name = "Test 1"
            milestone_form.date_deadline = fields.Date.today()

        try:
            with Form(self.env['project.update'].with_context({'default_project_id': self.project_pigs.id})) as update_form:
                update_form.name = "Test"
                update_form.progress = 65
            update = update_form.save()
        except Exception as e:
            raise AssertionError("Error raised unexpectedly while filling the project update form ! Exception : " + e.args[0])

        self.assertEqual(update.user_id, self.env.user, "The author is the user who created the update.")
        self.assertNotEqual(len(update.description), 0, "The description should not be empty.")
        self.assertTrue("Tasks" in update.description, "The description should contain 'Tasks'.")
        self.assertTrue("Milestone" in update.description, "The description should contain 'Milestone'.")
        self.assertEqual(update.status_id, self.env.ref('project.project_update_status_on_track'), "The status should be the default one.")

    def test_project_update_description(self):
        with Form(self.env['project.milestone'].with_context({'default_project_id': self.project_pigs.id})) as milestone_form:
            milestone_form.name = "Test 1"
            milestone_form.date_deadline = fields.Date.today()
        with Form(self.env['project.milestone'].with_context({'default_project_id': self.project_pigs.id})) as milestone_form:
            milestone_form.name = "Test 2"
            milestone_form.date_deadline = fields.Date.today()
        with Form(self.env['project.milestone'].with_context({'default_project_id': self.project_pigs.id})) as milestone_form:
            milestone_form.name = "Test 3"
            milestone_form.date_deadline = fields.Date.today() + relativedelta(years=2)

        template_values = self.env['project.update']._get_template_values(self.project_pigs.id)

        self.assertEqual(template_values['tasks']['open_tasks'], 0, "Open tasks should be equal to 0")
        self.assertEqual(template_values['tasks']['total_tasks'], 2, "Total tasks should be equal to 2")
        self.assertEqual(template_values['tasks']['created_tasks'], 2, "Created tasks should be equal to 2")
        self.assertEqual(template_values['tasks']['closed_tasks'], 0, "Closed tasks should be equal to 0")

        self.assertEqual(len(template_values['milestones']['list']), 2, "Milestone list length should be equal to 2")
        self.assertEqual(len(template_values['milestones']['created']), 3, "Milestone created length tasks should be equal to 3")

    def test_project_update_panel(self):
        with Form(self.env['project.milestone'].with_context({'default_project_id': self.project_pigs.id})) as milestone_form:
            milestone_form.name = "Test 1"
            milestone_form.date_deadline = fields.Date.today() + relativedelta(years=-1)
        with Form(self.env['project.milestone'].with_context({'default_project_id': self.project_pigs.id})) as milestone_form:
            milestone_form.name = "Test 2"
            milestone_form.date_deadline = fields.Date.today() + relativedelta(years=-1)
            milestone_form.is_done = True
        with Form(self.env['project.milestone'].with_context({'default_project_id': self.project_pigs.id})) as milestone_form:
            milestone_form.name = "Test 3"
            milestone_form.date_deadline = fields.Date.today() + relativedelta(years=2)

        panel_data = self.project_pigs.get_panel_data()

        self.assertEqual(len(panel_data['tasks_analysis']['data']), 2, "Panel data should contain 'tasks' entry")
        self.assertEqual(len(panel_data['milestones']['data']), 3, "Panel data should contain 'milestone' entry")
        self.assertTrue(panel_data['milestones']['data'][0]['is_deadline_exceeded'], "Milestone is exceeded")
        self.assertFalse(panel_data['milestones']['data'][1]['is_deadline_exceeded'], "Milestone is achieved")
        self.assertFalse(panel_data['milestones']['data'][0]['is_done'], "Milestone isn't done")
        self.assertTrue(panel_data['milestones']['data'][1]['is_done'], "Milestone is done")

@tagged('post_install', '-at_install')
class TestProjectUpdateUi(HttpCase):

    def test_01_project_tour(self):
        self.start_tour("/web", 'project_update_tour', login="admin")
