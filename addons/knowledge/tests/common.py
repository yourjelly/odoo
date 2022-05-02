# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.mail.tests.common import MailCommon, mail_new_test_user


class KnowledgeCommon(MailCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._activate_multi_company()

        cls.user_portal = cls._create_portal_user()
        cls.partner_portal = cls.user_portal.partner_id

        cls.user_employee_manager = mail_new_test_user(
            cls.env,
            company_id=cls.company_admin.id,
            country_id=cls.env.ref('base.be').id,
            groups='base.group_user',
            login='employee_manager',
            name='Evelyne Employee',
            notification_type='inbox',
            signature='--\nEvelyne'
        )
        cls.partner_employee_manager = cls.user_employee_manager.partner_id
        cls.user_employee2 = mail_new_test_user(
            cls.env,
            company_id=cls.company_admin.id,
            country_id=cls.env.ref('base.be').id,
            groups='base.group_user',
            login='employee2',
            name='Eglantine Employee',
            notification_type='inbox',
            signature='--\nEglantine'
        )
        cls.partner_employee2 = cls.user_employee2.partner_id

        cls.user_public = mail_new_test_user(
            cls.env,
            company_id=cls.company_admin.id,
            groups='base.group_public',
            login='user_public',
            name='Public Anonymous',
        )
        cls.partner_public = cls.user_public.partner_id

        cls.customer = cls.env['res.partner'].create({
            'country_id': cls.env.ref('base.be').id,
            'email': 'corentine@test.example.com',
            'mobile': '+32455001122',
            'name': 'Corentine Customer',
            'phone': '+32455334455',
        })

    def _create_private_article(self, name, target_user=None):
        """ Due to membership model constraints, create test records as sudo
        and return a record in current user environment. Creation itself is
        not tested here. """
        target_user = self.env.user if target_user is None else target_user
        if target_user:
            vals = {
                'article_member_ids': [(0, 0, {
                    'partner_id': target_user.partner_id.id,
                    'permission': 'write',
                })],
            }
        vals.update({
            'internal_permission': 'none',
            'name': name,
            })
        return self.env['knowledge.article'].sudo().create(vals).with_user(self.env.user)


class KnowledgeCommonWData(KnowledgeCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        # - Playground (workspace, writable)
        #   - Article1
        #   - Article2
        # - Private (shared)
        cls.article_workspace = cls.env['knowledge.article'].create(
            {'internal_permission': 'write',
             'name': 'Playground',
            }
        )
        cls.workspace_children = cls.env['knowledge.article'].create([
            {'name': 'Playground Child1',
             'parent_id': cls.article_workspace.id,
            },
            {'name': 'Playground Child2',
             'parent_id': cls.article_workspace.id,
            },
        ])
        cls.article_shared = cls.env['knowledge.article'].create(
            {'article_member_ids': [
                (0, 0, {'partner_id': cls.partner_admin.id,
                        'permission': 'write',
                       }),
                (0, 0, {'partner_id': cls.partner_employee.id,
                        'permission': 'read',
                       }),
                (0, 0, {'partner_id': cls.partner_employee_manager.id,
                        'permission': 'read',
                       }),
             ],
             'internal_permission': 'none',
             'name': 'Private',
            }
        )
        cls.shared_children = cls.env['knowledge.article'].create([
            {'article_member_ids': [
                (0, 0, {'partner_id': cls.partner_admin.id,
                        'permission': 'write',
                       }),
                (0, 0, {'partner_id': cls.partner_employee.id,
                        'permission': 'write',
                       }),
             ],
             'internal_permission': 'none',
             'name': 'Private Child1',
             'parent_id': cls.article_shared.id,
            }
        ])
