from odoo.tests import common
from odoo import Command


class TestEventHrSkills(common.TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.alice = cls.env['hr.employee'].create({
            'name': 'Alice',
            'email': 'alice@example.com',
        })
        cls.training_category_tag = cls.env['event.tag.category'].create({
            'name': 'Training',
            'show_on_resume': True,
            'tag_ids': [
                Command.create({'name': 'Sponsored MOOC'}),
                Command.create({'name': 'Internal Training'}),
            ],
        })
        cls.training_tag = cls.training_category_tag.tag_ids[1]
        cls.frobination_training = cls.env['event.event'].create({
            'name': 'Frobination Training',
            'tag_ids': [Command.link(cls.training_tag.id)]
        })
        cls.event_line_type = cls.env.ref('event_hr_skills.resume_type_events')

    def _employee_attended(self, employee, event):
        registration = self.env['event.registration'].create({
            'event_id': event.id,
            'state': 'done',
            'partner_id': employee.work_contact_id.id,
        })
        registration.flush_recordset()
        return registration

    def _event_resume_lines(self, employee):
        return employee.resume_line_ids.filtered(lambda l: l.line_type_id == self.event_line_type)

    def test_resume_line_created(self):
        """
        Check that after registering to a ``show_on_resume`` tagged event,
        a resume line is created.
        """

        self._employee_attended(self.alice, self.frobination_training)

        self.assertEqual(1, len(self._event_resume_lines(self.alice)))
        self.assertEqual(self._event_resume_lines(self.alice)[0].name, self.frobination_training.name)
        self.assertEqual(self._event_resume_lines(self.alice)[0].event_registration_id.event_id, self.frobination_training)
        self.assertEqual(self._event_resume_lines(self.alice)[0].line_type_id.id, self.env['hr.resume.line'].get_event_type_id())

    def test_show_on_resume(self):
        """
        Check that un/setting the ``show_on_resume`` field affects the line
        """
        self._employee_attended(self.alice, self.frobination_training)

        self.training_category_tag.show_on_resume = False
        self.env.flush_all()
        self.assertEqual(0, len(self._event_resume_lines(self.alice)), "Resume line should have been deleted")

        self.training_category_tag.show_on_resume = True
        self.env.flush_all()
        self.assertEqual(1, len(self._event_resume_lines(self.alice)))

    def test_tag_ids(self):
        """
        Check that modifying the tag_ids affects the line
        """
        self._employee_attended(self.alice, self.frobination_training)

        self.frobination_training.tag_ids = self.env['event.tag']
        self.env.flush_all()
        self.assertEqual(0, len(self._event_resume_lines(self.alice)), "Resume line should have been deleted")

        self.frobination_training.tag_ids = self.training_tag
        self.env.flush_all()
        self.assertEqual(1, len(self._event_resume_lines(self.alice)))

    def test_registration_state(self):
        """
        Check that setting the state of a registration to anything other
        than 'done' or deleting it affects the line.
        """
        reg = self._employee_attended(self.alice, self.frobination_training)

        reg.state = 'open'
        self.env.flush_all()
        self.assertEqual(0, len(self._event_resume_lines(self.alice)), "Resume line should have been deleted")

        reg.state = 'done'
        self.env.flush_all()
        self.assertEqual(1, len(self._event_resume_lines(self.alice)))

        reg.unlink()
        self.env.flush_all()
        self.assertEqual(0, len(self._event_resume_lines(self.alice)), "Resume line should have been deleted")
