# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
from odoo import http, _
from odoo.exceptions import UserError
from odoo.http import request

from odoo.addons.web.controllers.main import DataSet


class KnowledgeDataSet(DataSet):

    # ------------------------
    # Article CRUD controllers
    # ------------------------

    @http.route('/knowledge/article/<int:article_id>/rename', type='json', auth="user")
    def article_rename(self, article_id, title):
        request.env['knowledge.article'].browse(article_id).write({'name': title})
        return title

    @http.route('/knowledge/article/<int:article_id>/move', type='json', auth="user")
    def article_move(self, article_id, target_parent_id=False, before_article_id=False, private=False):
        Article = request.env['knowledge.article']

        parent = Article.browse(target_parent_id) if target_parent_id else False
        if target_parent_id and not parent:
            return "missing parent"  # The parent in which you want to move your article does not exist anymore
        before_article = Article.browse(before_article_id) if before_article_id else False
        if before_article_id and not before_article:
            return "missing article"  # The article before which you want to move your article does not exist anymore

        if before_article:
            sequence = before_article.sequence
        else:
            # get max sequence among articles with the same parent
            sequence = self._get_max_sequence_inside_parent(target_parent_id)

        values = {
            'parent_id': target_parent_id,
            'sequence': sequence
        }
        if not target_parent_id:
            # If parent_id, the write method will set the internal_permission based on the parent.
            # If moved from workspace to private -> set none. If moved from private to workspace -> set write
            values['internal_permission'] = 'none' if private else 'write'

        article = Article.browse(article_id)
        if not parent and private:  # If set private without parent, remove all members except current user.
            article.article_member_ids.unlink()
            values.update({
                'article_member_ids': [(0, 0, {
                    'partner_id': request.env.user.partner_id.id,
                    'permission': 'write'
                })]
            })

        article.write(values)
        return True

    @http.route('/knowledge/article/<int:article_id>/delete', type='json', auth="user")
    def article_delete(self, article_id):
        article = request.env['knowledge.article'].browse(article_id)
        if not article.exists():
            return False
        article.unlink()
        return True

    @http.route('/knowledge/article/<int:article_id>/duplicate', type='json', auth="user")
    def article_duplicate(self, article_id):
        article = request.env['knowledge.article'].browse(article_id)
        if not article.exists():
            return False
        new_article = article.copy({
            'name': _('%s (copy)') % article.name,
            'sequence': article.sequence + 1
        })

        return new_article.id

    @http.route('/knowledge/article/create', type='json', auth="user")
    def article_create(self, title=False, target_parent_id=False, private=False):
        Article = request.env['knowledge.article']
        parent = Article.browse(target_parent_id) if target_parent_id else False
        if target_parent_id and not parent:
            return "missing parent"  # The parent in which you want to create your article does not exist anymore

        values = {
            'internal_permission': 'none' if private else 'write',  # you cannot create an article without parent in shared directly.,
            'parent_id': target_parent_id,
            'sequence': self._get_max_sequence_inside_parent(target_parent_id)
        }
        if not parent and private:
            # To be private, the article need at least one member with write access.
            values.update({
                'article_member_ids': [(0, 0, {
                    'partner_id': request.env.user.partner_id.id,
                    'permission': 'write'
                })]
            })
        if title:
            values.update({
                'name': title,
                'body': title
            })

        article = Article.create(values)

        return article.id

    @http.route('/knowledge/article/<int:article_id>/lock', type='json', auth='user')
    def article_lock(self, article_id, is_locked):
        article = request.env['knowledge.article'].browse(article_id)
        if not article.exists():
            return False
        article.action_set_lock(is_locked)
        return True

    # ------
    # Others
    # ------

    @http.route('/knowledge/get_articles', type='http', auth="public", methods=['GET'], website=True, sitemap=False)
    def get_articles(self, query='', limit=25, **post):
        query = query.lower()
        records = [record for record in [{
            'id': 'private',
            'icon': False,
            'name': _('Private')
        }, {
            'id': 'workspace',
            'icon': False,
            'name': _('Workspace')
        }, {
            'id': 'shared',
            'icon': False,
            'name': _('Shared')
        }] if record.get('name').lower().find(query) != -1]
        Article = request.env['knowledge.article']
        domain = [
            ('name', '=ilike', '%' + query + '%')
        ]
        return json.dumps(records + Article.search_read(
            domain=domain,
            fields=['id', 'icon', 'name'],
            limit=max(0, int(limit) - len(records))
        ))

    @http.route('/knowledge/get_article/<int:article_id>', type='json', auth='user')
    def get_article(self, article_id):
        article = request.env['knowledge.article'].search_read(
            domain=[('id', '=', article_id)],
            fields=['id', 'icon', 'name'],
            limit=1
        )
        return article[0] if article else []

    # -----
    # Tools
    # -----

    def _get_max_sequence_inside_parent(self, parent_id):
        max_sequence_article = request.env['knowledge.article'].search(
            [('parent_id', '=', parent_id)],
            order="sequence desc",
            limit=1
        )
        return max_sequence_article.sequence + 1 if max_sequence_article else 0

