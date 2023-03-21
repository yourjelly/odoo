# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.http import request, route, Controller
import requests
import json


class MailGifController(Controller):

    def request_gifs(self, url):
        try:
            response = requests.get(url, timeout=3)
        except requests.exceptions.RequestException:
            return False
        if response.status_code != requests.codes.ok:
            return False
        return response

    @route("/discuss/gif/search", type="json", auth="public", cors="*")
    def mail_gif_search(self, search_term, locale="en", country="US", pos=False):
        api_key = request.env["ir.config_parameter"].sudo().get_param("mail.tenor_api_key")
        content_filter = request.env["ir.config_parameter"].sudo().get_param("mail.tenor_content_filter")
        ckey = request.env.cr.dbname
        tenor_url = request.env["ir.config_parameter"].sudo().get_param("mail.tenor_url")
        tenor_gif_limit = request.env["ir.config_parameter"].sudo().get_param("mail.tenor_gif_limit")
        url = f"{tenor_url}/v2/search?q={search_term}&key={api_key}&client_key={ckey}&limit={tenor_gif_limit}&contentfilter={content_filter}&locale={locale}&country={country}&media_filter=tinygif"
        if pos:
            url = f"{url}&pos={pos}"
        response = self.request_gifs(url)
        if response:
            return json.loads(response.content)

    @route("/discuss/gif/categories", type="json", auth="public", cors="*")
    def mail_gif_categorie(self, locale="en", country="US"):
        api_key = request.env["ir.config_parameter"].sudo().get_param("mail.tenor_api_key")
        content_filter = request.env["ir.config_parameter"].sudo().get_param("mail.tenor_content_filter")
        ckey = request.env.cr.dbname
        tenor_url = request.env["ir.config_parameter"].sudo().get_param("mail.tenor_url")
        url = f"{tenor_url}/v2/categories?key={api_key}&client_key={ckey}&contentfilter={content_filter}&locale={locale}&country={country}"
        response = self.request_gifs(url)
        if response:
            return json.loads(response.content)

    @route("/discuss/gif/set_favorite", type="json", auth="user")
    def set_gif_favorite(self, tenor_gif_id):
        request.env["mail.gif.favorite"].create({"tenor_gif_id": tenor_gif_id})

    def mail_gif_posts(self, ids):
        ckey = request.env.cr.dbname
        api_key = request.env["ir.config_parameter"].sudo().get_param("mail.tenor_api_key")
        tenor_url = request.env["ir.config_parameter"].sudo().get_param("mail.tenor_url")
        url = f"{tenor_url}/v2/posts?key={api_key}&client_key={ckey}&ids={','.join(ids)}&media_filter=tinygif"
        response = self.request_gifs(url)
        if response:
            return json.loads(response.content)["results"]

    @route("/discuss/gif/favorites", type="json", auth="user")
    def get_gif_favorites(self, offset=0):
        tenor_gif_ids = request.env["mail.gif.favorite"].search([("create_uid", "=", request.env.user.id)], limit=20, offset=offset)
        return {
            "results": self.mail_gif_posts(tenor_gif_ids.mapped("tenor_gif_id")) or [],
            "offset": offset + 20
        }

    @route("/discuss/gif/remove_favorite", type="json", auth="user")
    def remove_gif_favorite(self, tenor_gif_id):
        return request.env["mail.gif.favorite"].search([("create_uid", "=", request.env.user.id), ("tenor_gif_id", "=", tenor_gif_id)]).unlink()
