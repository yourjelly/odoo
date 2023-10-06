import base64

from odoo.http import Controller, content_disposition, request, route
from odoo.tools import consteq

from ..utils.image_utils import scale_image

# from https://github.com/monperrus/crawler-user-agents
SOCIAL_NETWORK_USER_AGENTS = (
    # Facebook
    'Facebot',
    'facebookexternalhit',
    # Twitter
    'Twitterbot',
    # LinkedIn
    'LinkedInBot',
    # Whatsapp
    'WhatsApp',
    # Pinterest
    'Pinterest',
    'Pinterestbot',
)


class MarketingCardController(Controller):

    @route(['/cards/<int:campaign_id>/<int:res_id>/<string:hash_token>/card.jpg'], type='http', auth='public', sitemap=False, website=True)
    def card_campaign_image(self, campaign_id, res_id, hash_token, small=False):
        campaign_sudo = request.env['card.campaign'].sudo().browse(campaign_id).exists()
        if not campaign_sudo or not consteq(hash_token, campaign_sudo._generate_card_hash_token(res_id)):
            raise request.not_found()

        target_sudo = request.env[campaign_sudo.res_model].sudo().browse(res_id).exists()
        if not target_sudo:
            return request.not_found()

        card_sudo = campaign_sudo._get_or_create_cards_from_res_ids([res_id])

        if self._is_crawler(request) and card_sudo.share_status != 'shared':
            request.env['bus.bus']._sendone(f'card_shared_target-{campaign_id}-{hash_token}', 'marketing_card/share_card_target', {
                'message': campaign_sudo.reward_message,
                'reward_url': campaign_sudo.reward_target_url,
            })
            card_sudo.share_status = 'shared'

        image_bytes = base64.b64decode(card_sudo._get_or_generate_image())
        image_bytes = image_bytes if not small else scale_image(image_bytes, 0.5)
        return request.make_response(image_bytes, [
            ('Content-Type', ' image/jpeg'),
            ('Content-Length', len(image_bytes)),
            ('Content-Disposition', content_disposition('card.jpg')),
        ])


    @route(['/cards/<int:campaign_id>/<int:res_id>/<string:hash_token>/preview'], type='http', auth='public', sitemap=False, website=True)
    def card_campaign_preview(self, campaign_id, res_id, hash_token):
        """Route for users to preview their card and share it on their social platforms."""
        campaign_sudo = request.env['card.campaign'].sudo().browse(campaign_id).exists()
        if not campaign_sudo or not consteq(hash_token, campaign_sudo._generate_card_hash_token(res_id)):
            return request.not_found()

        target_sudo = request.env[campaign_sudo.res_model].sudo().browse(res_id).exists()
        if not target_sudo:
            return request.not_found()

        card_sudo = campaign_sudo._get_or_create_cards_from_res_ids([res_id])
        if not card_sudo.share_status:
            card_sudo.share_status = 'visited'

        return request.render('marketing_card.card_campaign_preview', {
            'campaign_id': campaign_id,
            'image_url': card_sudo._get_card_url(small=True),
            'link_shared_thanks_message': campaign_sudo.reward_message if card_sudo.share_status == 'shared' else '',
            'link_shared_reward_url': campaign_sudo.reward_target_url if card_sudo.share_status == 'shared' else '',
            'post_text': campaign_sudo.post_suggestion or '',
            'share_url': card_sudo._get_redirect_url(),
            'target_name': target_sudo.display_name if target_sudo else '',
            'hash_token': hash_token,
        })

    @route(['/cards/<int:campaign_id>/<int:res_id>/<string:hash_token>/redirect'], type='http', auth='public', sitemap=False, website=True)
    def card_campaign_redirect(self, campaign_id, res_id, hash_token):
        """Route to redirect users to the target url, or display the opengraph embed text for web crawlers.

        When a user posts a link on an application supporting opengraph, the application will follow
        the link to fetch specific meta tags on the web page to get preview information such as a preview card.
        The "crawler" performing that action usually has a specific user agent.

        As we cannot necessarily control the target url of the campaign we must return a different
        result when a social network crawler is visiting the URL to get preview information.
        From the perspective of the crawler, this url is an empty page with opengraph tags.
        For all other user agents, it's a simple redirection url.

        Keeping an up-to-date list of user agents for each supported target website is imperative
        for this app to work.
        """
        campaign_sudo = request.env['card.campaign'].sudo().browse(campaign_id).exists()
        if not campaign_sudo or not consteq(hash_token, campaign_sudo._generate_card_hash_token(res_id)):
            return request.not_found()

        target_sudo = request.env[campaign_sudo.res_model].sudo().browse(res_id).exists()
        if not target_sudo:
            return request.not_found()

        card_sudo = campaign_sudo._get_or_create_cards_from_res_ids([res_id])
        redirect_url = campaign_sudo.link_tracker_id.short_url or campaign_sudo.target_url or campaign_sudo.get_base_url()

        if self._is_crawler(request):
            return request.render('marketing_card.card_campaign_crawler', {
                'image_url': card_sudo._get_card_url(),
                'post_text': campaign_sudo.post_suggestion,
                'target_name': target_sudo.display_name or '',
            })

        return request.redirect(redirect_url)

    @staticmethod
    def _is_crawler(request):
        """Returns True if the request is made by a social network crawler."""
        return request.httprequest.user_agent.string in SOCIAL_NETWORK_USER_AGENTS
