# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.website.tools import MockRequest
from odoo.addons.website_forum.controllers.website_forum import WebsiteForum
from odoo.addons.website_forum.tests.common import KARMA, TestForumCommon


class TestForumController(TestForumCommon):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._activate_multi_website()
        cls.minimum_karma_allowing_to_post = KARMA['ask']
        cls.forums = cls.env['forum.forum'].create([{
            'name': f'Forum {idx + 2}',
            'karma_ask': cls.minimum_karma_allowing_to_post,
            'website_id': website.id,
        } for idx, website in enumerate(
            (cls.base_website, cls.base_website, cls.base_website, cls.website_2, cls.website_2))])
        cls.forum_1, cls.forum_2, cls.forum_3, cls.forum_1_website_2, cls.forum_2_website_2 = cls.forums
        cls.controller = WebsiteForum()

    def _get_my_other_forums(self, forum):
        """ Get user other forums limited to the forums of the test (self.forums). """
        return self.forums & self.controller._prepare_user_values(forum=forum).get('my_other_forums')

    def forum_post(self, user, forum):
        return self.env['forum.post'].with_user(user).create({
            'content': 'A post ...',
            'forum_id': forum.id,
            'name': 'Post...',
        })

    def forum_tags(self, user, forum, size=10):
        return self.env['forum.tag'].with_user(user).create([
            {
                'name': f'tag_{i}',
                'forum_id': forum.id,
            }
            for i in range(size)
        ])

    def test_prepare_user_values_my_other_forum(self):
        """ Test user other forums values (my_other_forums) in various contexts. """
        employee_2_forum_2_post = self.forum_post(self.user_employee_2, self.forum_2)
        employee_2_website_2_forum_2_post = self.forum_post(self.user_employee_2, self.forum_2_website_2)
        for user in (self.user_admin, self.user_employee, self.user_portal, self.user_public):
            with self.with_user(user.login), MockRequest(self.env, website=self.base_website):
                self.assertFalse(self._get_my_other_forums(self.forum_1))
                self.assertFalse(self._get_my_other_forums(None))
                self.assertFalse(self._get_my_other_forums(True))
                if user != self.user_public:
                    self.env.user.karma = self.minimum_karma_allowing_to_post
                    # Like a post on forum 2 and verify that forum 2 is now in "my other forum"
                    employee_2_forum_2_post.favourite_ids += self.env.user
                    self.assertEqual(self._get_my_other_forums(self.forum_1), self.forum_2)
                    self.assertFalse(self._get_my_other_forums(self.forum_2))
                    # Check similarly with posting and also checking that we don't see forum of website 2
                    self.forum_post(self.env.user, self.forum_3)
                    self.forum_post(self.env.user, self.forum_1_website_2)
                    self.assertEqual(self._get_my_other_forums(self.forum_1), self.forum_2 + self.forum_3)
                    self.assertEqual(self._get_my_other_forums(self.forum_2), self.forum_3)
                    self.assertEqual(self._get_my_other_forums(self.forum_3), self.forum_2)
            with self.with_user(user.login), MockRequest(self.env, website=self.website_2):
                self.assertFalse(self._get_my_other_forums(None))
                self.assertFalse(self._get_my_other_forums(True))
                if user != self.user_public:
                    self.assertFalse(self._get_my_other_forums(self.forum_1_website_2))
                    self.assertEqual(self._get_my_other_forums(self.forum_2_website_2), self.forum_1_website_2)
                    employee_2_website_2_forum_2_post.favourite_ids += self.env.user
                    self.assertEqual(self._get_my_other_forums(self.forum_1_website_2), self.forum_2_website_2)

    def test_prepare_related_posts(self):
        """Test the method returns 5 related posts based on tag similarity"""
        # Create forum posts and associate them tags
        forum_tags = self.forum_tags(self.user_admin, self.forum_1)
        forum_posts = self.env['forum.post'].with_user(self.user_admin).create(
            [
                {
                    'content': 'A post ...',
                    'forum_id': self.forum_1.id,
                    'name': 'Post...',
                    'tag_ids': forum_tags[:i]
                }
                for i in range(len(forum_tags) + 1)  # 11 posts with 0 to 10 tags
            ]
        )
        # No post, should return None
        self.assertEqual(self.controller._prepare_related_posts(), None)
        # First post (not tags), should return None
        self.assertEqual(self.controller._prepare_related_posts(post=forum_posts[0]), None)
        # Second post, most similar posts should be the 5 following posts
        self.assertEqual(self.controller._prepare_related_posts(post=forum_posts[1]), forum_posts[2:7])
        # Last post, most similar posts should be the 5 preceding posts in descending order
        self.assertEqual(self.controller._prepare_related_posts(post=forum_posts[-1]),
                            forum_posts[len(forum_posts) - 6: -1].sorted(reverse=True))
