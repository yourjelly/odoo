# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.knowledge.tests.common import KnowledgeCommon
from odoo.tests.common import tagged, users
from odoo.tools import mute_logger


@tagged('knowledge_sequence')
class TestKnowledgeArticleSequence(KnowledgeCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        with mute_logger('odoo.models.unlink'):
            cls.env['knowledge.article'].search([]).unlink()

        # define starting sequence for root articles
        cls.article_root_noise = cls.env['knowledge.article'].create([
            {'internal_permission': 'write',
             'name': 'Existing1',
             'sequence': 1,
            },
            {'internal_permission': 'write',
             'name': 'Existing2',
             'sequence': 3,
            }
        ])

        # - Article 1
        #   - Article 1.1
        #   - Article 1.2
        #     - Article 1.2.1
        #   - Article 1.3
        # - Article 2
        cls.article_private = cls._create_private_article(cls, 'Article1', target_user=cls.user_employee)
        cls.article_children = cls.env['knowledge.article'].create([
            {'name': 'Article1.1',
             'parent_id': cls.article_private.id,
            },
            {'name': 'Article1.2',
             'parent_id': cls.article_private.id,
            },
        ])
        cls.article_children += cls.env['knowledge.article'].create([
            {'name': 'Article1.2.1',
             'parent_id': cls.article_children[1].id,
            },
        ])
        cls.article_children += cls.env['knowledge.article'].create([
            {'name': 'Article1.3',
             'parent_id': cls.article_private.id,
            }
        ])
        cls.article_private2 = cls._create_private_article(cls, 'Article2', target_user=cls.user_employee)
        for article in cls.article_children[0:3]:
            article.action_toggle_favorite()

        # flush everything to ease resequencing and date-based computation
        (cls.article_root_noise + cls.article_private + cls.article_children + cls.article_private2).flush()

    def assertSortedSequence(self, articles):
        """
        Assert that the articles are properly sorted according to their sequence number
        :param articles (Model<knowledge.article>): Recordset of knowledge.article
        """
        for k in range(len(articles) - 1):
            self.assertTrue(
                articles[k].sequence <= articles[k + 1].sequence,
                f'Article sequence issue: {articles[k].name} ({articles[k].sequence}) which is not <= than {articles[k + 1].name} ({articles[k + 1].sequence})')

    @users('employee')
    def test_initial_tree(self):
        # parents
        article_private = self.article_private.with_env(self.env)
        article_children = self.article_children.with_env(self.env)
        article_private2 = self.article_private2.with_env(self.env)

        self.assertFalse(article_private.parent_id)
        self.assertEqual((article_children[0:2] + article_children[3:]).parent_id, article_private)
        self.assertEqual(article_children[2].parent_id, article_children[1])
        self.assertFalse(article_private2.parent_id)
        # ancestors
        self.assertEqual((article_private + article_children).root_article_id, article_private)
        self.assertEqual(article_private2.root_article_id, article_private2)
        # categories
        self.assertEqual(article_private.category, 'private')
        self.assertEqual(set(article_children.mapped('category')), set(['private']))
        self.assertEqual(article_private2.category, 'private')
        # user permission
        self.assertEqual(article_private.user_permission, 'write')
        self.assertEqual(set(article_children.mapped('user_permission')), set(['write']))
        self.assertEqual(article_private2.user_permission, 'write')
        self.assertEqual(article_private.inherited_permission, 'none')
        self.assertEqual(set(article_children.mapped('inherited_permission')), set(['none']))
        self.assertEqual(article_private2.inherited_permission, 'none')
        # favorites
        self.assertFalse(article_private.is_user_favorite)
        self.assertEqual(article_children.mapped('is_user_favorite'),
                         [False, False, False, False])
        self.assertFalse(article_private.is_user_favorite)
        # sequences
        self.assertSortedSequence(article_private + article_private2)
        self.assertSortedSequence(article_children[0:2] + article_children[3])

    @users('employee')
    def test_resequence_with_move(self):
        """Checking the sequence of the articles"""
        article_private = self.article_private.with_env(self.env)
        article_children = self.article_children.with_env(self.env)
        article_private2 = self.article_private2.with_env(self.env)

        # move last child "Article 1.3" before "Article 1.2"
        last_child = article_children[3]
        last_child.move_to(parent_id=article_private.id, before_article_id=article_children[1].id)
        # expected
        # - Article 1
        #     - Article 1.1
        #     - Article 1.3
        #     - Article 1.2
        #         - Article 1.2.1
        # - Article 6
        self.assertFalse(article_private.parent_id)
        self.assertEqual((article_children[0:2] + article_children[3:]).parent_id, article_private)
        self.assertEqual(article_children[2].parent_id, article_children[1])
        self.assertFalse(article_private2.parent_id)
        self.assertSortedSequence(article_private + article_private2)
        self.assertSortedSequence(article_children[0] + article_children[3] + article_children[1])

        # move "Article 1.2.1" in first position under "Article 1"
        article_children[2].move_to(parent_id=article_private.id, before_article_id=article_children[0].id)
        # expected
        # - Article 1
        #     - Article 1.2.1
        #     - Article 1.1
        #     - Article 1.3
        #     - Article 1.2
        # - Article 6
        self.assertFalse(article_private.parent_id)
        self.assertEqual(article_children.parent_id, article_private)
        self.assertFalse(article_private2.parent_id)
        self.assertSortedSequence(article_private + article_private2)
        self.assertSortedSequence(article_children[2] + article_children[0] + article_children[3] + article_children[1])

        # move "Article 1.1" in last position under "Article 1"
        article_children[0].move_to(parent_id=article_private.id, before_article_id=False)
        # expected
        # - Article 1
        #     - Article 1.2.1
        #     - Article 1.3
        #     - Article 1.2
        #     - Article 1.1
        # - Article 6
        self.assertFalse(article_private.parent_id)
        self.assertEqual(article_children.parent_id, article_private)
        self.assertFalse(article_private2.parent_id)
        self.assertSortedSequence(article_private + article_private2)
        self.assertSortedSequence(article_children[2] + article_children[3] + article_children[1] + article_children[0])
