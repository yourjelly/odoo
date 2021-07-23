# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from base64 import b64encode, b64decode

from odoo.tests.common import TransactionCase
from odoo.tools import file_open


class TestAvatarMixin(TransactionCase):
    """ tests the avatar mixin """

    def setUp(self):
        super(TestAvatarMixin, self).setUp()
        self.partner_without_image = self.env['res.partner'].create({
            'name': 'Marc Demo',
            'email': 'mark.brown23@example.com',
            'image_1920': False
        })
        self.user_without_image = self.env['res.users'].create({
            'login': 'demo_1',
            'password': 'demo_1',
            'partner_id': self.partner_without_image.id
        })
        self.partner_without_name = self.env['res.partner'].create({
            'name': '',
            'email': 'marc.grey25@example.com',
            'image_1920': False
        })
        self.user_without_name = self.env['res.users'].create({
            'login': 'marc_1',
            'password': 'marc_1',
            'partner_id': self.partner_without_name.id
        })
        self.external_partner = self.env['res.partner'].create({
            'name': 'Josh Demo',
            'email': 'josh.brown23@example.com',
            'image_1920': False
        })
        self.placeholderAvatarImage = b64encode(file_open("base/static/img/avatar_grey.png", 'rb').read())

    def test_partner_has_avatar_even_if_it_has_no_image(self):
        self.assertIsNotNone(self.partner_without_image.avatar_128)
        self.assertIsNotNone(self.partner_without_image.avatar_256)
        self.assertIsNotNone(self.partner_without_image.avatar_512)
        self.assertIsNotNone(self.partner_without_image.avatar_1024)
        self.assertIsNotNone(self.partner_without_image.avatar_1920)

    def test_content_of_generated_partner_avatar(self):
        time_now = '2015-11-12 00:00:00'
        self._set_partner_create_date(self.partner_without_image.id, time_now)
        self.partner_without_image.invalidate_cache()  # cache invalidated so create_date is updated
        expectedAvatar = (
            "<?xml version='1.0' encoding='UTF-8' ?>"
            "<svg height='180' width='180' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'>"
            "<rect fill='hsl(184, 40%, 45%)' height='180' width='180'/>"
            "<text fill='#ffffff' font-size='96' text-anchor='middle' x='90' y='125' font-family='sans-serif'>M</text>"
            "</svg>"
        )
        self.assertEqual(expectedAvatar, b64decode(self.partner_without_image.avatar_1920).decode('utf-8'))

    def test_partner_without_name_has_default_placeholder_image_as_avatar(self):
        self.assertEqual(self.placeholderAvatarImage, self.partner_without_name.avatar_1920)

    def test_external_partner_has_default_placeholder_image_as_avatar(self):
        self.assertEqual(self.placeholderAvatarImage, self.external_partner.avatar_1920)

    def test_partner_and_user_have_the_same_avatar(self):
        self.assertEqual(self.partner_without_image.avatar_1920, self.user_without_image.avatar_1920)

    def _set_partner_create_date(self, partner_id, newdate):
        """ This method is a hack in order to be able to define/redefine the create_date
            of partners.
            This is done in SQL because ORM does not allow to write onto the create_date field.
        """
        self.env.cr.execute("UPDATE res_partner SET create_date = '%s' WHERE id = %s" % (newdate, partner_id))
