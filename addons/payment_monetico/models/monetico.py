# -*- coding: utf-'8' "-*-"

import hashlib
import hmac
import logging
from openerp.tools.translate import _
import time
import encodings.hex_codec

from openerp import api, fields, models
from openerp.addons.payment.models.payment_acquirer import ValidationError
from openerp.addons.payment_monetico.controllers.main import MoneticoController
from openerp.tools import float_round, DEFAULT_SERVER_DATE_FORMAT
from openerp.tools.float_utils import float_compare, float_repr

_logger = logging.getLogger(__name__)


class PaymentAcquirerMonetico(models.Model):
    _inherit = 'payment.acquirer'

    def _get_monetico_urls(self, environment):
        """ Authorize URLs """
        if environment == 'prod':
            return {'monetico_form_url': 'https://p.monetico-services.com/test/paiement.cgi'}
        else:
            return {'monetico_form_url': 'https://p.monetico-services.com/test/paiement.cgi'}

    @api.model
    def _get_providers(self):
        providers = super(PaymentAcquirerMonetico, self)._get_providers()
        providers.append(['monetico', 'Monetico'])
        return providers

    monetico_key = fields.Char(string='Key', required_if_provider='monetico')
    monetico_ept_number = fields.Char(string='EPT Number', required_if_provider='monetico')
    monetico_version = fields.Char(string='Version', required_if_provider='monetico')
    monetico_company_code = fields.Char(string='Company Code', size=32, required_if_provider='monetico')
    monetico_url_ok = fields.Char(string='URL OK', required_if_provider='monetico')
    monetico_url_ko = fields.Char(string='URL KO', required_if_provider='monetico')

    @api.multi
    def monetico_form_generate_values(self, values):
        self.ensure_one()
        base_url = self.env['ir.config_parameter'].get_param('web.base.url')
        monetico_tx_values = dict(values)
        temp_monetico_tx_values = {
            'version': self.monetico_version,
            'TPE': self.monetico_ept_number,
            'date': time.strftime('%d/%m/%Y:%H:%M:%S'),
            'montant': '%s%s' % (values.get('amount'), values.get('currency').name),
            'reference': values.get('reference'),
            'url_retour': self.monetico_url_ok,
            'url_retour_ok': self.monetico_url_ok,
            'url_retour_err': self.monetico_url_ko,
            'lgue': values.get('partner_lang')[:2].upper(),
            'societe': self.monetico_company_code,
            'texte_libre': 'ExempleTexteLibre',
            'mail': values.get('partner_email'),
        }
        keys = "TPE date montant reference texte_libre version lgue societe mail nbrech dateech1 montantech1 dateech2 montantech2 dateech3 montantech3 dateech4 montantech4 options".split()
        temp_monetico_tx_values['MAC'] = self._monetico_generate_mac(keys, temp_monetico_tx_values)
        monetico_tx_values.update(temp_monetico_tx_values)
        return monetico_tx_values

    def _monetico_generate_mac(self, keys, values):

        def get_value(key):
            if values.get(key):
                return values[key]
            return ''

        mac = '*'.join('%s' % get_value(k) for k in keys)

        hexStrKey = self._getUsableKey(self.monetico_key)

        HMAC = hmac.HMAC(hexStrKey,None,hashlib.sha1)
        HMAC.update(mac.encode('iso8859-1'))

        return HMAC.hexdigest()

    #See Monetico Kit implementation for this method
    #https://www.monetico-paiement.fr/fr/installer/telechargements/kit_telechargeable.aspx
    def _getUsableKey(self, monetico_key):

        hexStrKey  = monetico_key[0:38]
        hexFinal   = monetico_key[38:40] + "00";

        cca0=ord(hexFinal[0:1])

        if cca0>70 and cca0<97 :
            hexStrKey += chr(cca0-23) + hexFinal[1:2]
        elif hexFinal[1:2] == "M" :
            hexStrKey += hexFinal[0:1] + "0"
        else :
            hexStrKey += hexFinal[0:2]

        c =  encodings.hex_codec.Codec()
        hexStrKey = c.decode(hexStrKey)[0]

        return hexStrKey

    @api.multi
    def monetico_get_form_action_url(self):
        self.ensure_one()
        return self._get_monetico_urls(self.environment)['monetico_form_url']

class TxMonetico(models.Model):
    _inherit = 'payment.transaction'

    _monetico_test_tx_status = 'payetest'
    _monetico_valid_tx_status = 'paiement'
    _monetico_cancel_tx_status = 'Annulation'

    @api.model
    def _monetico_form_get_tx_from_data(self, data):
        """ Given a data dict coming from monetico, verify it and find the related
        transaction record. """
        reference, mac = data.get('reference'), data.get('MAC')
        if not reference or not mac:
            error_msg = _('Monetico: received data with missing reference (%s) or mac (%s)') % (reference, mac)
            _logger.error(error_msg)
            raise ValidationError(error_msg)

        # find tx
        tx = self.search([('reference', '=', reference)])
        if not tx or len(tx) > 1:
            error_msg = 'Monetico: received data for reference %s' % (reference)
            if not tx:
                error_msg += '; no order found'
            else:
                error_msg += '; multiple order found'
            _logger.error(error_msg)
            raise ValidationError(error_msg)
        return tx[0]

    @api.model
    def _monetico_form_get_invalid_parameters(self, tx, data):
        invalid_parameters = []
        return invalid_parameters

    @api.model
    def _monetico_form_validate(self, tx, data):
        if tx.state == 'done':
            _logger.warning('Monetico: trying to validate an already validated tx (ref %s)' % tx.reference)
            return True
        status_code = int(data.get('code-retour', '0'))

        if status_code == self._monetico_test_tx_status:
            tx.write({
                'state': 'done',
                'acquirer_reference': data.get('reference'),
            })
            return True
        elif status_code == self._monetico_valid_tx_status:
            tx.write({
                'state': 'done',
                'acquirer_reference': data.get('reference'),
            })
            return True
        elif status_code == self._monetico_cancel_tx_status:
            tx.write({
                'state': 'cancel',
                'acquirer_reference': data.get('x_trans_id'),
            })
            return True
        else:
            error = data.get('x_response_reason_text')
            _logger.info(error)
            tx.write({
                'state': 'error',
                'state_message': error,
                'acquirer_reference': data.get('x_trans_id'),
            })
            return False
