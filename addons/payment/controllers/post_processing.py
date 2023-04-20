# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
from datetime import timedelta

import psycopg2

from odoo import fields, http
from odoo.http import request

_logger = logging.getLogger(__name__)


class PaymentPostProcessing(http.Controller):

    """
    This controller is responsible for the monitoring and finalization of the post-processing of
    transactions.

    It exposes the route `/payment/status`: All payment flows must go through this route at some
    point to allow the user checking on the transactions' status, and to trigger the finalization of
    their post-processing.
    """

    MONITORED_TX_IDS_KEY = '__payment_monitored_tx_ids__'

    @http.route('/payment/status', type='http', auth='public', website=True, sitemap=False)
    def display_status(self, **kwargs):
        """ Display the payment status page.

        :param dict kwargs: Optional data. This parameter is not used here
        :return: The rendered status page
        :rtype: str
        """
        return request.render('payment.payment_status')

    @http.route('/payment/status/poll', type='json', auth='public')
    def poll_status(self, **_kwargs):
        """ Fetch the transaction to display on the status page and finalize its post-processing.

        :return: The post-processing values of the transaction
        :rtype: dict
        """
        # Retrieve last user's transaction from the session
        limit_date = fields.Datetime.now() - timedelta(days=1)
        monitored_tx = request.env['payment.transaction'].sudo().search([
            ('id', '=', self.get_monitored_transaction_id()),
            ('last_state_change', '>=', limit_date)
        ])
        if not monitored_tx:  # The transaction was not correctly created
            return {
                'success': False,
                'error': 'no_tx_found',
            }

        # Build display values dictionary with the display message and post-processing values
        display_message = None
        if monitored_tx.state == 'pending':
            display_message = monitored_tx.provider_id.pending_msg
        elif monitored_tx.state == 'done':
            display_message = monitored_tx.provider_id.done_msg
        elif monitored_tx.state == 'cancel':
            display_message = monitored_tx.provider_id.cancel_msg
        display_values = {
            'display_message': display_message,
            **monitored_tx._get_post_processing_values(),
        }

        # Finalize post-processing transaction before displaying it to the user
        success, error = True, None
        if monitored_tx.state == 'done':
            try:
                monitored_tx._finalize_post_processing()
            except psycopg2.OperationalError:  # A collision of accounting sequences occurred
                request.env.cr.rollback()  # Rollback and try later
                success = False
                error = 'tx_process_retry'
            except Exception as e:
                request.env.cr.rollback()
                success = False
                error = str(e)
                _logger.exception(
                    "encountered an error while post-processing transaction with id %s:\n%s",
                    str(monitored_tx.id), e
                )

        return {
            'success': success,
            'error': error,
            'display_values': display_values,
        }

    @classmethod
    def monitor_transaction(cls, transaction):
        """ Make the provided transaction id monitored.

        :param recordset transaction: The transaction to monitor, as a `payment.transaction`
                                       recordset
        :return: None
        """
        request.session[cls.MONITORED_TX_IDS_KEY] = transaction.id

    @classmethod
    def get_monitored_transaction_id(cls):
        """ Return the ids of transactions being monitored.

        Only the ids and not the recordset itself is returned to allow the caller browsing the
        recordset with sudo privileges, and using the ids in a custom query.

        :return: The ids of transactions being monitored
        :rtype: list
        """
        return request.session.get(cls.MONITORED_TX_IDS_KEY)
