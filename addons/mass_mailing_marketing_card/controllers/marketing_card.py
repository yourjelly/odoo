import base64

from odoo.http import content_disposition, request, route
from odoo.addons.marketing_card.controllers.marketing_card import MarketingCardController

class MarketingCardController(MarketingCardController):

    @route(['/cards/<int:campaign_id>/card.jpg'])
    def card_campaign_image_placeholder(self, campaign_id):
        campaign_sudo = request.env['card.campaign'].browse(campaign_id).exists()
        if not campaign_sudo:
            return request.not_found()
        image_bytes = base64.b64decode(campaign_sudo._get_generic_image_b64())
        return request.make_response(image_bytes, [
            ('Content-Type', ' image/jpeg'),
            ('Content-Length', len(image_bytes)),
            ('Content-Disposition', content_disposition('card.jpg')),
        ])
