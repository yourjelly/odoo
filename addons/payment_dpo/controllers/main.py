# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import pprint

from odoo import http
from odoo.http import request


_logger = logging.getLogger(__name__)


class DPOController(http.Controller):
    _return_url = '/payment/dpo/return'

    @http.route(_return_url, type='http', auth='public', methods=['GET'])
    def dpo_return_from_checkout(self, **data):
        """ Process the notification data sent by DPO after redirection.

        :param dict data: The notification data, including the provider id appended to the URL in
                          `_get_specific_rendering_values`.
        """
        _logger.info("Handling redirection from DPO with data:\n%s", pprint.pformat(data))

        # TODO-DPO call _handle_notification_data

        # Redirect the user to the status page.
        return request.redirect('/payment/status')

    #TODO-DPO implement the webhook?
