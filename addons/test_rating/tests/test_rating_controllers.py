# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import http
from odoo.exceptions import AccessError
from odoo.tests.common import HttpCase

class TestRating(HttpCase):

	def setUp(self):
		super().setUp()
		self.record = self.env['rated'].with_context(mail_create_nolog=True).create({'name': 'My rated record'})
		self.mail_record = self.env['mail.rated'].with_context(mail_create_nolog=True).create({'name': 'My mail rated record'})
		self.rating_token = self.record.rating_get_access_token()
		self.mail_rating_token = self.mail_record.rating_get_access_token()
		# otherwise self.record.rating_ids is still empty, seems louche
		self.record.invalidate_cache()
		self.mail_record.invalidate_cache()

	def test_simple_rating(self):
		self.url_open(url=f'/rating/{self.rating_token}/5')
		rating = self.record.rating_ids
		rating.invalidate_cache()
		self.assertEqual(rating.rating, 5)
		self.assertTrue(rating.consumed)

	def test_feedback(self):
		data = {
			'rate': 5,
			'feedback': "Great",
			'csrf_token': http.WebRequest.csrf_token(self),
		}
		self.url_open(url=f'/rating/{self.rating_token}/submit_feedback', data=data)
		rating = self.record.rating_ids
		rating.invalidate_cache()
		self.assertEqual(rating.rating, 5)
		self.assertTrue(rating.consumed)

	def test_mail_simple_rating(self):
		self.url_open(url=f'/rating/{self.mail_rating_token}/5')
		rating = self.mail_record.rating_ids
		rating.invalidate_cache()
		self.assertEqual(rating.rating, 5)
		self.assertTrue(rating.consumed)
		self.assertTrue(self.mail_record.message_ids, "A message should have been posted")
		self.assertIn('rating_5', self.mail_record.message_ids.body, "It should contain the associated rating image")

	def test_mail_feedback(self):
		data = {
			'rate': 5,
			'feedback': "Great",
			'csrf_token': http.WebRequest.csrf_token(self),
		}
		self.url_open(url=f'/rating/{self.mail_rating_token}/submit_feedback', data=data)
		rating = self.mail_record.rating_ids
		rating.invalidate_cache()
		self.assertEqual(rating.rating, 5)
		self.assertTrue(rating.consumed)
		self.assertTrue(self.mail_record.message_ids, "A message should have been posted")
		self.assertIn('rating_5', self.mail_record.message_ids.body, "It should contain the associated rating image")
