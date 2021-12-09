# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import werkzeug
from werkzeug.utils import redirect

from odoo import http, tools
from odoo.http import request


class KnowledgeController(http.Controller):

    # ------------------------
    # Article Access Routes
    # ------------------------

    @http.route('/knowledge/article/invite/<int:member_id>/<string:invitation_hash>', type='http', auth='public')
    def article_invite(self, member_id, invitation_hash):
        """ This route will check if the given parameter allows the client to access the article via the invite token.
        Then, if the partner has not registered yet, we will redirect the client to the signup page to finally redirect
        them to the article.
        If the partner already has registrered, we redirect them directly to the article.
        """
        member = request.env['knowledge.article.member'].sudo().browse(member_id).exists()
        correct_token = member._get_invitation_hash() if member else False
        if not correct_token or not tools.consteq(correct_token, invitation_hash):
            raise werkzeug.exceptions.NotFound()

        partner = member.partner_id
        article = member.article_id

        if not partner.user_ids:
            # Force the signup even if not enabled (as we explicitly invited the member).
            # They should still be able to create a user.
            signup_allowed = request.env['res.users']._get_signup_invitation_scope() == 'b2c'
            if not signup_allowed:
                partner.signup_prepare()
            partner.signup_get_auth_param()
            signup_url = partner._get_signup_url_for_action(url='/knowledge/article/%s' % article.id)[partner.id]
            return redirect(signup_url)

        return redirect('/web/login?redirect=/knowledge/article/%s' % article.id)

    @http.route('/knowledge/article/<int:article_id>', type='http', auth='user')
    def redirect_to_article(self, article_id):
        """ This route will redirect internal users to the backend view of the article and the share users to the
        frontend view instead."""
        article = self._fetch_article(article_id)
        if request.env.user.has_group('base.group_user'):
            if not article:
                return werkzeug.exceptions.Forbidden()
            return redirect("/web#id=%s&model=knowledge.article&action=%s&menu_id=%s" % (
                article.id,
                request.env["ir.actions.actions"]._for_xml_id("knowledge.knowledge_article_dashboard_action")['id'],
                request.env.ref('knowledge.knowledge_menu_root').id
            ))
        return request.render('knowledge.knowledge_article_view_frontend', {
            'article': article,
            'portal_readonly_mode': True,  # used to bypass access check (to speed up loading)
            'show_sidebar': bool(self._get_root_articles(limit=1))
        })

    def _fetch_article(self, article_id):
        """ Check the access of the given article for the current user. """
        Article = request.env['knowledge.article']
        article = Article.browse(article_id).exists()
        if not request.env.user._is_public() and article.user_has_access:
            return article
        return Article

    # ------------------------
    # Articles tree generation
    # ------------------------

    def _get_root_articles(self, limit=None):
        """ Meant to be overriden by website_knowledge to search in sudo with adapted domain."""
        return request.env["knowledge.article"].search([("parent_id", "=", False)], limit=limit, order='sequence')

    def _prepare_articles_tree_html(self, template, active_article=False, unfolded_articles=False):
        """
        This method prepares all the info needed to render the article tree view side panel and returns the rendered
        given template with those values.
        :param active_article: (Model<knowledge.article>) Used to highlight the given article_id in the template
        :param unfolded_articles: (list of ids) Used to display the children of the given article ids.
            unfolded articles are saved into local storage. When reloading/opening the article page, previously
            unfolded articles nodes must be opened.
        :return: (Dict) that will be used to render templates in the articles tree side panel.
        """
        unfolded_articles = set() if not unfolded_articles else set(unfolded_articles)
        # root articles = starting point of the tree view : unfold only if root_article in (accessible) parents
        parents = active_article._get_parents()
        if active_article.main_article_id in parents:
            unfolded_articles |= set(parents.ids)

        root_articles = self._get_root_articles()

        values = {
            "active_article": active_article,
            "workspace_articles": root_articles.filtered(lambda article: article.category == 'workspace'),
            "shared_articles": root_articles.filtered(lambda article: article.category == 'shared'),
            "unfolded_articles": unfolded_articles,
        }
        favorites = request.env['knowledge.article.favorite']
        if not request.env.user._is_public():
            favorites = request.env['knowledge.article.favorite'].search([
                ("user_id", "=", request.env.user.id), ('article_id.active', '=', True)
            ])
        values["favorites"] = favorites
        # To avoid computing owner_id, don't compute private_articles if share user (they cannot own an article)
        private_articles = request.env['knowledge.article.favorite']
        if not request.env.user.share:
            private_articles = root_articles.filtered(lambda article: article.owner_id == request.env.user)
        values['private_articles'] = private_articles

        return request.env['ir.qweb']._render(template, values)

    @http.route('/knowledge/tree_panel', type='json', auth='user')
    def get_tree_panel_all(self, active_article_id=False, unfolded_articles=False):
        return self._prepare_articles_tree_html(
            'knowledge.knowledge_article_tree',
            active_article=self._fetch_article(active_article_id),
            unfolded_articles=unfolded_articles
        )

    @http.route('/knowledge/tree_panel/portal', type='json', auth='public')
    def get_tree_panel_portal(self, active_article_id=False, unfolded_articles=False):
        return self._prepare_articles_tree_html(
            'knowledge.knowledge_article_tree_frontend',
            active_article=self._fetch_article(active_article_id),
            unfolded_articles=unfolded_articles
        )

    @http.route('/knowledge/tree_panel/children', type='json', auth='user')
    def get_tree_panel_children(self, parent_id):
        parent = self._fetch_article(parent_id)
        if not parent:
            return werkzeug.exceptions.NotFound()
        return request.env['ir.qweb']._render('knowledge.articles_template', {
            'articles': parent.child_ids,
            'portal_readonly_mode': request.env.user._is_public(),  # used to bypass access check (to speed up loading)
        })

    @http.route('/knowledge/tree_panel/favorites', type='json', auth='user')
    def get_tree_panel_favorites(self, active_article_id=False):
        favorite_articles = request.env['knowledge.article.favorite'].search([
            ("user_id", "=", request.env.user.id), ('article_id.active', '=', True)
        ])
        return request.env['ir.qweb']._render('knowledge.knowledge_article_tree_favorites', {
            'favorites': favorite_articles,
            "active_article": request.env['knowledge.article'].browse(active_article_id),
        })

    # ------------------------
    # Article permission panel
    # ------------------------

    @http.route('/knowledge/get_article_permission_panel_data', type='json', auth='user')
    def get_article_permission_panel_data(self, article_id):
        """
        Returns a dictionnary containing all values required to render the permission panel.
        :param article_id: (int) article id
        """
        Article = request.env['knowledge.article']
        article = self._fetch_article(article_id)
        if not article:
            return werkzeug.exceptions.Forbidden()
        is_sync = not article.is_desynchronized
        # Get member permission info
        members_values = []
        members_permission = article._get_article_member_permissions()[article.id]

        # retrieve all involved partners info
        results = request.env['res.partner'].search_read([('id', 'in', list(members_permission.keys()))],
                                                         fields=['id', 'name', 'user_ids', 'partner_share'])
        partners_info = {
            partner['id']: {'name': partner['name'], 'user_ids': partner['user_ids'], 'share': partner['partner_share']}
            for partner in results}

        # retrieve all member browse records
        Members = request.env['knowledge.article.member']
        member_partner_rel = {member["member_id"]: partner_id for partner_id, member in members_permission.items() if
                              partner_id}
        members = Members.browse(list(member_partner_rel.keys())).exists() if member_partner_rel else Members
        write_members = members.filtered(lambda m: m.permission == 'write')

        # retrieve all involved "based on" articles info
        based_on_article_ids = [members_permission[partner_id]['based_on'] for partner_id in partners_info.keys()]
        results = Article.search_read([('id', 'in', based_on_article_ids)], fields=['id', 'display_name'])
        based_on_articles = {article['id']: {'name': article['display_name']} for article in results}

        for member in members:
            partner_id = member_partner_rel[member.id]
            permission = members_permission[partner_id]['permission']
            # if share partner and permission = none, don't show it in the permisison panel.
            if permission == 'none' and partners_info[partner_id]['share']:
                continue
            based_on_id = members_permission[partner_id]['based_on']
            based_on_article = based_on_articles.get(based_on_id, {})
            # if article is desyncronized, don't show members based on parent articles.
            if not is_sync and based_on_article:
                continue
            user_ids = partners_info[partner_id]['user_ids']
            member_values = {
                'id': member.id,
                'partner_id': partner_id,
                'partner_name': partners_info[partner_id]['name'],
                'permission': permission,
                'based_on': based_on_article.get('name'),
                'based_on_id': based_on_id,
                'has_higher_permission': member.has_higher_permission,
                'user_ids': user_ids,
                'is_external': not user_ids,
                'is_unique_writer': len(
                    write_members) == 1 and member == write_members and article.inherited_permission != "write",
            }
            # Optional values:
            if member.partner_id.email:
                member_values['email'] = member.partner_id.email
            members_values.append(member_values)
        internal_permission_field = request.env['knowledge.article']._fields['internal_permission']
        permission_field = request.env['knowledge.article.member']._fields['permission']
        user_is_admin = request.env.user.has_group('base.group_system')
        return {
            'internal_permission_options': internal_permission_field.get_description(request.env).get('selection', []),
            'internal_permission': article.inherited_permission,
            'parent_permission': article.parent_id.inherited_permission,
            'based_on': article.inherited_permission_parent_id.display_name,
            'based_on_id': article.inherited_permission_parent_id.id,
            'members_options': permission_field.get_description(request.env).get('selection', []),
            'members': members_values,
            'is_sync': is_sync,
            'parent_id': article.parent_id.id,
            'parent_name': article.parent_id.display_name,
            'user_is_admin': user_is_admin,
            'show_admin_tip': user_is_admin and article.user_permission != 'write',
        }

    @http.route('/knowledge/article/set_member_permission', type='json', auth='user')
    def article_set_member_permission(self, article_id, permission, member_id=False, partner_id=False, **post):
        """
        Sets the permission of the given member for the given article.
        **Note**: The user needs "write" permission to change the permission of a user.
        :param article_id: (int) article id
        :param permission: (string) permission
        :param member_id: (int) member id
        :param partner_id: (int) partner id. Typically given when the member is based on a parent article.
        """
        article = request.env['knowledge.article'].sudo().browse(article_id)
        if not article.user_can_write:
            return werkzeug.exceptions.Forbidden()
        previous_category = article.category
        if partner_id:  # If based on
            partner = request.env['res.partner'].browse(partner_id).exists()
            if not article or not partner:
                return {'success': False}
            member = request.env['knowledge.article.member'].browse(member_id).exists()
            downgrade = bool(member) and member.permission > permission
            if (not downgrade and not article.invite_members(partner, permission, send_mail=False)) \
                    or (downgrade and not article._desync_access_from_parents(partner.ids, permission)):
                return {'success': False}
        elif not article or not article._set_member_permission(member_id, permission):
            return {'success': False}
        result = {'success': True}
        if article.category != previous_category:
            result['reload_tree'] = True
        return result

    @http.route('/knowledge/article/remove_member', type='json', auth='user')
    def article_remove_member(self, article_id, member_id, partner_id=False):
        """
        Removes the given member from the given article.
        The function returns a dictionary indicating whether the request succeeds (see: `success` key).
        The dictionary can also include a `reload_tree` entry that will signify the caller that the aside block
        listing all articles should be reloaded. This can happen when the article moves from one section to another.
        **Note**: The user needs "write" permission to remove another member from
        the list. The user can always remove themselves from the list.
        :param article_id: (int) article id
        :param member_id: (int) member id
        :param partner_id: (int) partner id. Typically given when the member is based on a parent article
            and we need to desync the article from its parent (and ensure the partner to removed is well removed
            after the desynchronization).
        """
        article = request.env['knowledge.article'].sudo().browse(article_id)
        if not article.user_can_write:
            return werkzeug.exceptions.Forbidden()
        previous_category = article.category
        if partner_id:  # If the permission is based on parent article -> Desync article
            partner = request.env['res.partner'].browse(partner_id).exists()
            article_member_partners_ids = article.article_member_ids.partner_id.ids
            if not article or not partner or not article._desync_access_from_parents(article_member_partners_ids):
                return {'success': False}
            # remove the partner if was copied from parent
            article.article_member_ids.filtered(lambda m: m.partner_id.id == partner_id).unlink()
        elif not article.exists() or not article._remove_member(member_id):
            return {'success': False}
        result = {'success': True}
        if article.category != previous_category:
            result['reload_tree'] = True
        return result

    @http.route('/knowledge/article/set_internal_permission', type='json', auth='user')
    def article_set_internal_permission(self, article_id, permission, **post):
        """
        Sets the internal permission of the given article.
        The function returns a dictionary indicating whether the request succeeds (see: `success` key).
        The dictionary can also include a `reload_tree` entry that will signify the caller that the aside block
        listing all articles should be reloaded. This can happen when the article moves from one section to another.
        **Note**: The user needs "write" permission to update the internal permission of the article.
        :param article_id: (int) article id
        :param permission: (string) permission
        """
        article = request.env['knowledge.article'].browse(article_id)
        if not article.user_can_write:
            return werkzeug.exceptions.Forbidden()
        previous_category = article.category
        if not article._set_internal_permission(permission):
            return {'success': False}
        result = {'success': True}
        if article.category != previous_category:
            result['reload_tree'] = True
        return result
