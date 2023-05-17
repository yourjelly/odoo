# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import pprint

from werkzeug import urls

from odoo import _, fields, models
from odoo.exceptions import UserError, ValidationError

from odoo.addons.payment import utils as payment_utils
from odoo.addons.payment_stripe.const import STATUS_MAPPING
from odoo.addons.payment_stripe.controllers.main import StripeController


_logger = logging.getLogger(__name__)


class PaymentTransaction(models.Model):
    _inherit = 'payment.transaction'

    def _get_specific_processing_values(self, processing_values):
        """ Override of payment to return Stripe-specific processing values.

        Note: self.ensure_one() from `_get_processing_values`

        :param dict processing_values: The generic processing values of the transaction
        :return: The dict of provider-specific processing values
        :rtype: dict
        """
        res = super()._get_specific_processing_values(processing_values)
        if self.provider_code != 'stripe' or self.operation == 'online_token':
            return res

        intent = self._stripe_create_intent()
        base_url = self.provider_id.get_base_url()
        return {
            'client_secret': intent['client_secret'],
            'return_url': f'{urls.url_join(base_url, StripeController._return_url)}' \
                          f'?reference={urls.url_quote_plus(self.reference)}',
        }

    def _stripe_create_customer(self):
        """ Create and return a Customer.

        :return: The Customer
        :rtype: dict
        """
        customer = self.provider_id._stripe_make_request(
            'customers', payload={
                'address[city]': self.partner_city or None,
                'address[country]': self.partner_country_id.code or None,
                'address[line1]': self.partner_address or None,
                'address[postal_code]': self.partner_zip or None,
                'address[state]': self.partner_state_id.name or None,
                'description': f'Odoo Partner: {self.partner_id.name} (id: {self.partner_id.id})',
                'email': self.partner_email or None,
                'name': self.partner_name,
                'phone': self.partner_phone and self.partner_phone[:20] or None,
            }
        )
        return customer

    def _get_common_stripe_session_values(self, pmt_values, customer):
        """ Return the Stripe Session values that are common to redirection and validation.

        Note: This method serves as a hook for modules that would fully implement Stripe Connect.

        :param dict pmt_values: The payment method types values
        :param dict customer: The Stripe customer to assign to the session
        :return: The common Stripe Session values
        :rtype: dict
        """
        return {
            **pmt_values,
            # Assign a customer to the session so that Stripe automatically attaches the payment
            # method to it in a validation flow. In checkout flow, a customer is automatically
            # created if not provided but we still do it here to avoid requiring the customer to
            # enter his email on the checkout page.
            'customer': customer['id'],
        }

    def _send_payment_request(self):
        """ Override of payment to send a payment request to Stripe with a confirmed PaymentIntent.

        Note: self.ensure_one()

        :return: None
        :raise: UserError if the transaction is not linked to a token
        """
        super()._send_payment_request()
        if self.provider_code != 'stripe':
            return

        if not self.token_id:
            raise UserError("Stripe: " + _("The transaction is not linked to a token."))

        # Make the payment request to Stripe
        payment_intent = self._stripe_create_intent()
        _logger.info(
            "payment request response for transaction with reference %s:\n%s",
            self.reference, pprint.pformat(payment_intent)
        )
        if not payment_intent:  # The PI might be missing if Stripe failed to create it.
            return  # There is nothing to process; the transaction is in error at this point.

        # Handle the payment request response
        notification_data = {'reference': self.reference}
        StripeController._include_payment_intent_in_notification_data(
            payment_intent, notification_data
        )
        self._handle_notification_data('stripe', notification_data)

    def _stripe_create_intent(self):
        """ Create and return a PaymentIntent.

        Note: self.ensure_one()

        :return: The Payment Intent
        :rtype: dict
        """
        if self.operation == 'validation':
            response = self.provider_id._stripe_make_request(
                'setup_intents',
                payload=self._stripe_prepare_setup_intent_payload(),
            )
        elif self.operation in ['online_token', 'offline']:
            if not self.token_id.stripe_payment_method:  # Pre-SCA token -> migrate it
                self.token_id._stripe_sca_migrate_customer()

            response = self.provider_id._stripe_make_request(
                'payment_intents',
                payload=self._stripe_prepare_payment_intent_payload(payment_by_token=True),
                offline=self.operation == 'offline',
                # Prevent multiple offline payments by token (e.g., due to a cursor rollback).
                idempotency_key=payment_utils.generate_idempotency_key(
                    self, scope='payment_intents_token'
                ) if self.operation == 'offline' else None,
            )
        else:  # 'online_direct' (express checkout).
            response = self.provider_id._stripe_make_request(
                'payment_intents',
                payload=self._stripe_prepare_payment_intent_payload(),
            )

        if 'error' not in response:
            intent = response
        else:  # A processing error was returned in place of the intent
            # The request failed and no error was raised because we are in an offline payment flow.
            # Extract the error from the response, log it, and set the transaction in error to let
            # the calling module handle the issue without rolling back the cursor.
            error_msg = response['error'].get('message')
            _logger.error(
                "The creation of the intent failed.\n"
                "Stripe gave us the following info about the problem:\n'%s'", error_msg
            )
            self._set_error("Stripe: " + _(
                "The communication with the API failed.\n"
                "Stripe gave us the following info about the problem:\n'%s'", error_msg
            ))  # Flag transaction as in error now as the intent status might have a valid value
            intent = response['error'].get(
                'payment_intent',
                response['error'].get('setup_intent')
            )  # Get the intent from the error

        return intent

    def _stripe_prepare_setup_intent_payload(self):
        """ Prepare the payload for the creation of a setup intent in Stripe format.

        Note: This method serves as a hook for modules that would fully implement Stripe Connect.
        Note: self.ensure_one()

        :return: The Stripe-formatted payload for the setup intent request
        :rtype: dict
        """
        customer = self._stripe_create_customer()
        return {
            'customer': customer['id'],
            'description': self.reference,
            'payment_method_types[]': 'card',
            **self._stripe_get_mandate_options(),
        }

    def _stripe_prepare_payment_intent_payload(self, payment_by_token=False):
        """ Prepare the payload for the creation of a payment intent in Stripe format.

        Note: This method serves as a hook for modules that would fully implement Stripe Connect.
        Note: self.ensure_one()

        :param boolean payment_by_token: Whether the payment is made by token or not.
        :return: The Stripe-formatted payload for the payment intent request
        :rtype: dict
        """
        payment_intent_payload = {
            'amount': payment_utils.to_minor_currency_units(self.amount, self.currency_id),
            'currency': self.currency_id.name.lower(),
            'description': self.reference,
            'capture_method': 'manual' if self.provider_id.capture_manually else 'automatic',
        }
        if payment_by_token:
            payment_intent_payload.update(
                confirm=True,
                customer=self.token_id.provider_ref,
                off_session=True,
                payment_method=self.token_id.stripe_payment_method,
                mandate=self.token_id.stripe_mandate_id,
            )
        else:
            payment_intent_payload.update({
                'automatic_payment_methods[enabled]': True,
            })
            if self.tokenize:
                customer = self._stripe_create_customer()
                payment_intent_payload.update(
                    customer=customer['id'],
                    setup_future_usage='off_session',
                    **self._stripe_get_mandate_options(),
                )
        return payment_intent_payload

    def _stripe_get_mandate_options(self):
        mandate_specific_values = self._get_mandate_specific_values()

        mandate_options = {
            'payment_method_options[card][mandate_options][reference]': self.reference,
            'payment_method_options[card][mandate_options][amount_type]': 'maximum',
            'payment_method_options[card][mandate_options][amount]': payment_utils.to_minor_currency_units(mandate_specific_values.get('amount', 1500000), self.currency_id),  # TODO VCR change that
            'payment_method_options[card][mandate_options][start_date]': int(round((mandate_specific_values.get('start_date') or fields.Datetime.now()).timestamp())),
            'payment_method_options[card][mandate_options][interval]': 'sporadic',
            'payment_method_options[card][mandate_options][supported_types][]': 'india',
        }

        if mandate_specific_values.get('end_date'):
            mandate_options.update({
                'payment_method_options[card][mandate_options][end_date]': int(
                    round(mandate_specific_values.end_date.timestamp())
                ),
            })

        if mandate_specific_values.get('reccurence_unit') and mandate_specific_values.get('reccurence_duration'):
            mandate_options.update({
                'payment_method_options[card][mandate_options][interval]': mandate_specific_values['reccurence_unit'],
                'payment_method_options[card][mandate_options][interval_count]': mandate_specific_values['reccurence_duration'],
            })

        if self.operation == 'validation':
            mandate_options.update({
                'payment_method_options[card][mandate_options][currency]': self.provider_id._get_validation_currency().name.lower(),
            })


        return mandate_options

    def _send_refund_request(self, amount_to_refund=None):
        """ Override of payment to send a refund request to Stripe.

        Note: self.ensure_one()

        :param float amount_to_refund: The amount to refund.
        :return: The refund transaction created to process the refund request.
        :rtype: recordset of `payment.transaction`
        """
        refund_tx = super()._send_refund_request(amount_to_refund=amount_to_refund)
        if self.provider_code != 'stripe':
            return refund_tx

        # Make the refund request to stripe.
        data = self.provider_id._stripe_make_request(
            'refunds', payload={
                'payment_intent': self.provider_reference,
                'amount': payment_utils.to_minor_currency_units(
                    -refund_tx.amount,  # Refund transactions' amount is negative, inverse it.
                    refund_tx.currency_id,
                ),
            }
        )
        _logger.info(
            "Refund request response for transaction wih reference %s:\n%s",
            self.reference, pprint.pformat(data)
        )
        # Handle the refund request response.
        notification_data = {}
        StripeController._include_refund_in_notification_data(data, notification_data)
        refund_tx._handle_notification_data('stripe', notification_data)

        return refund_tx

    def _send_capture_request(self, amount_to_capture=None):
        """ Override of `payment` to send a capture request to Stripe. """
        child_capture_tx = super()._send_capture_request(amount_to_capture=amount_to_capture)
        if self.provider_code != 'stripe':
            return child_capture_tx

        # Make the capture request to Stripe
        payment_intent = self.provider_id._stripe_make_request(
            f'payment_intents/{self.provider_reference}/capture'
        )
        _logger.info(
            "capture request response for transaction with reference %s:\n%s",
            self.reference, pprint.pformat(payment_intent)
        )

        # Handle the capture request response
        notification_data = {'reference': self.reference}
        StripeController._include_payment_intent_in_notification_data(
            payment_intent, notification_data
        )
        self._handle_notification_data('stripe', notification_data)

        return child_capture_tx

    def _send_void_request(self, amount_to_void=None):
        """ Override of `payment` to send a void request to Stripe. """
        child_void_tx = super()._send_void_request(amount_to_void=amount_to_void)
        if self.provider_code != 'stripe':
            return child_void_tx

        # Make the void request to Stripe
        payment_intent = self.provider_id._stripe_make_request(
            f'payment_intents/{self.provider_reference}/cancel'
        )
        _logger.info(
            "void request response for transaction with reference %s:\n%s",
            self.reference, pprint.pformat(payment_intent)
        )

        # Handle the void request response
        notification_data = {'reference': self.reference}
        StripeController._include_payment_intent_in_notification_data(
            payment_intent, notification_data
        )
        self._handle_notification_data('stripe', notification_data)

        return child_void_tx

    def _get_tx_from_notification_data(self, provider_code, notification_data):
        """ Override of payment to find the transaction based on Stripe data.

        :param str provider_code: The code of the provider that handled the transaction
        :param dict notification_data: The notification data sent by the provider
        :return: The transaction if found
        :rtype: recordset of `payment.transaction`
        :raise: ValidationError if inconsistent data were received
        :raise: ValidationError if the data match no transaction
        """
        tx = super()._get_tx_from_notification_data(provider_code, notification_data)
        if provider_code != 'stripe' or len(tx) == 1:
            return tx

        reference = notification_data.get('reference')
        if reference:
            tx = self.search([('reference', '=', reference), ('provider_code', '=', 'stripe')])
        elif notification_data.get('event_type') == 'charge.refund.updated':
            # The webhook notifications sent for `charge.refund.updated` events only contain a
            # refund object that has no 'description' (the merchant reference) field. We thus search
            # the transaction by its provider reference which is the refund id for refund txs.
            refund_id = notification_data['object_id']  # The object is a refund.
            tx = self.search([('provider_reference', '=', refund_id), ('provider_code', '=', 'stripe')])
        else:
            raise ValidationError("Stripe: " + _("Received data with missing merchant reference"))

        if not tx:
            raise ValidationError(
                "Stripe: " + _("No transaction found matching reference %s.", reference)
            )
        return tx

    def _process_notification_data(self, notification_data):
        """ Override of payment to process the transaction based on Adyen data.

        Note: self.ensure_one()

        :param dict notification_data: The notification data build from information passed to the
                                       return route. Depending on the operation of the transaction,
                                       the entries with the keys 'payment_intent',
                                       'setup_intent' and 'payment_method' can be populated with
                                       their corresponding Stripe API objects.
        :return: None
        :raise: ValidationError if inconsistent data were received
        """
        super()._process_notification_data(notification_data)
        if self.provider_code != 'stripe':
            return

        # Handle the provider reference and the status.
        if self.operation == 'validation':
            self.provider_reference = notification_data['setup_intent']['id']
            status = notification_data['setup_intent']['status']
        elif self.operation == 'refund':
            self.provider_reference = notification_data['refund']['id']
            status = notification_data['refund']['status']
        else:  # 'online_direct', 'online_token', 'offline'
            self.provider_reference = notification_data['payment_intent']['id']
            status = notification_data['payment_intent']['status']
        if not status:
            raise ValidationError(
                "Stripe: " + _("Received data with missing intent status.")
            )

        if status in STATUS_MAPPING['draft']:
            pass
        elif status in STATUS_MAPPING['pending']:
            self._set_pending()
        elif status in STATUS_MAPPING['authorized']:
            if self.tokenize:
                self._stripe_tokenize_from_notification_data(notification_data)
            self._set_authorized()
        elif status in STATUS_MAPPING['done']:
            if self.tokenize:
                self._stripe_tokenize_from_notification_data(notification_data)

            self._set_done()

            # Immediately post-process the transaction if it is a refund, as the post-processing
            # will not be triggered by a customer browsing the transaction from the portal.
            if self.operation == 'refund':
                self.env.ref('payment.cron_post_process_payment_tx')._trigger()
        elif status in STATUS_MAPPING['cancel']:
            self._set_canceled()
        elif status in STATUS_MAPPING['error']:
            if self.operation != 'refund':
                last_payment_error = notification_data.get('payment_intent', {}).get(
                    'last_payment_error'
                )
                if last_payment_error:
                    message = last_payment_error.get('message', {})
                else:
                    message = _("The customer left the payment page.")
                self._set_error(message)
            else:
                self._set_error(_(
                    "The refund did not go through. Please log into your Stripe Dashboard to get "
                    "more information on that matter, and address any accounting discrepancies."
                ), extra_allowed_states=('done',))
        else:  # Classify unknown intent statuses as `error` tx state
            _logger.warning(
                "received invalid payment status (%s) for transaction with reference %s",
                status, self.reference
            )
            self._set_error(_("Received data with invalid intent status: %s", status))

    def _stripe_tokenize_from_notification_data(self, notification_data):
        """ Create a new token based on the notification data.

        :param dict notification_data: The notification data built with Stripe objects.
                                       See `_process_notification_data`.
        :return: None
        """
        if self.operation == 'online_direct':
            payment_method_id = notification_data.get('payment_method').get('id')
            customer_id = notification_data.get('payment_intent').get('customer')
            mandate_id = notification_data['payment_intent']['charges']['data'][0]['payment_method_details']['card'].get('mandate')
        else:  # 'validation'
            payment_method_id = notification_data.get('payment_method').get('id')
            customer_id = notification_data.get('setup_intent').get('customer')
            mandate_id = notification_data.get('setup_intent').get('mandate')
        payment_method = notification_data.get('payment_method')
        if not payment_method_id or not payment_method:
            _logger.warning(
                "requested tokenization from notification data with missing payment method"
            )
            return

        if payment_method.get('type') != 'card':
            # Only 'card' payment methods can be tokenized. This case should normally not happen as
            # non-recurring payment methods are not shown to the customer if the "Save my payment
            # details checkbox" is shown. Still, better be on the safe side.
            _logger.warning("requested tokenization of non-recurring payment method")
            return

        token = self.env['payment.token'].create({
            'provider_id': self.provider_id.id,
            'payment_details': payment_method['card'].get('last4'),
            'partner_id': self.partner_id.id,
            'provider_ref': customer_id,
            'verified': True,
            'stripe_payment_method': payment_method_id,
            'stripe_mandate_id': mandate_id,
        })
        self.write({
            'token_id': token,
            'tokenize': False,
        })
        _logger.info(
            "created token with id %(token_id)s for partner with id %(partner_id)s from "
            "transaction with reference %(ref)s",
            {
                'token_id': token.id,
                'partner_id': self.partner_id.id,
                'ref': self.reference,
            },
        )
