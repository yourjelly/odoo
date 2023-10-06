
# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _
from odoo.http import Controller, request, route
from odoo.addons.portal.controllers.web import Home

from .user_agents import NETWORK_TO_AGENT

class EventSharePostController(Controller):

    @route(['/social_share/post/card.png'], type='http', auth='public')
    def social_share_post_image(self, share_campaign=None, target_id=None):
        if not share_campaign:
            return request.not_found()
        campaign = request.env['social.share.post'].sudo().browse(int(share_campaign)).exists()
        template = campaign.share_template_id

        target = None
        if campaign.model_id:
            if not target_id:
                return request.not_found()
            else:
                target = request.env[campaign.model_id.model].sudo().browse(int(target_id)).exists()

        image_bytes = template.with_user(campaign.user_id)._generate_image_bytes(target)
        return request.make_response(image_bytes, [('Content-Type', ' image/png')])

    @route(['/social_share/post'], type='http', auth='public')
    def social_share_post_visitor(self, share_campaign=None, target_id=None, **kwargs):
        """Route for users to preview their card and share it on their social platforms."""
        campaign = request.env['social.share.post'].sudo().browse(int(share_campaign)).exists()

        if not campaign:
            return request.not_found()

        target = None

        if campaign.model_id:
            if not target_id:
                return request.not_found()
            else:
                target = request.env[campaign.model_id.model].sudo().browse(int(target_id)).exists()
            if not target:
                return request.not_found()

        return request.render('social_share.share_post_visitor', {
            'image_url': self._get_card_url(share_campaign, target_id),
            'share_link': self._get_redirect_url(share_campaign, target_id),
            'target_id': target_id, 'model_id': campaign.model_id.model,
            'target_name': target.display_name if target else '',
        })

    @route(['/social_share/redirect'], type='http', auth='public')
    def social_share_post_redirect(self, share_campaign=None, target_id=None, **kwargs):
        """Route to redirect users to the target url, or display the opengraph embed text for web crawlers."""
        campaign = request.env['social.share.post'].sudo().browse(int(share_campaign)).exists()
        if not campaign:
            return request.not_found()
        target = False
        if campaign.model_id:
            target = request.env[campaign.model_id.model].sudo().browse(int(target_id)).exists()
            if not target:
                return request.not_found()
        redirect_url = campaign.target_url

        user_agent = request.httprequest.user_agent.string
        for agent_names in NETWORK_TO_AGENT.values():
            if any(agent_name in user_agent for agent_name in agent_names):
                return request.render('social_share.share_post_crawler', {
                    'image_url': self._get_card_url(share_campaign, target_id),
                    'target_name': target.name if target and target.name else 'Unsure Yet',
                    'redirect_url': 'redirect_url',
                })
        return request.redirect(redirect_url)

    @staticmethod
    def _get_card_url(share_campaign_id, target_id):
        base = request.env['ir.config_parameter'].sudo().get_param('web.base.url')
        return f'{base}/social_share/post/card.png?share_campaign={share_campaign_id}' + (f'&target_id={target_id}' if target_id else '')

    @staticmethod
    def _get_redirect_url(share_campaign_id, target_id):
        base = request.env['ir.config_parameter'].sudo().get_param('web.base.url')
        return f'{base}/social_share/redirect?share_campaign={share_campaign_id}' + (f'&target_id={target_id}' if target_id else '')
