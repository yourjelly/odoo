import re

from odoo import models
from odoo.addons.web.models.models import lazymapping


CARD_IMAGE_URL = re.compile(r'(src=".*?\/cards)\/([0-9]+)(?=\/card.jpg")')
CARD_PREVIEW_URL = re.compile(r'(href=".*?\/cards)\/([0-9]+)(?=\/preview")')


class MailMail(models.Model):
    """Add custom card url to mailings"""
    _inherit = ['mail.mail']

    def _prepare_outgoing_body_apply_mailing_tracking(self, body):
        """Update mailing specific links to replace generic card urls with email-specific links."""
        campaign_tokens = lazymapping(
            lambda campaign_id: self.env['card.campaign'].browse(campaign_id)._generate_card_hash_token(self.res_id)
        )

        def fill_card_url(match):
            campaign_id = int(match[2])
            return f'{match[1]}/{campaign_id}/{self.res_id}/{campaign_tokens[campaign_id]}'

        if not self.res_id or not self.mailing_id:
            return super()._prepare_outgoing_body_apply_mailing_tracking(body)

        body = re.sub(CARD_IMAGE_URL, fill_card_url, body)
        body = re.sub(CARD_PREVIEW_URL, fill_card_url, body)

        # defer creation of cards used for tracking sent count
        marketing_card_values = self.env.cr.precommit.data.setdefault('marketing_card_create_cards_values', [])
        marketing_card_values.extend([
            {'campaign_id': campaign_id, 'res_id': self.res_id} for campaign_id in campaign_tokens
        ])
        self.env.cr.precommit.add(self.env['card.card']._deferred_create)

        return super()._prepare_outgoing_body_apply_mailing_tracking(body)
