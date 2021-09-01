# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from base64 import b64decode
from pytz import timezone
from datetime import datetime
from OpenSSL import crypto

from odoo import _, api, fields, models, tools
from odoo.exceptions import ValidationError


class Certificate(models.Model):
    _name = 'l10n_es_edi.certificate'
    _description = 'Personal Digital Certificate'
    _order = 'date_start desc, id desc'
    _rec_name = 'serial_number'

    content = fields.Binary(string="File", required=True, help="PFX Certificate")
    password = fields.Char(help="Passphrase for the PFX certificate", groups="base.group_system")
    serial_number = fields.Char(readonly=True, index=True, help="The serial number to add to electronic documents")
    date_start = fields.Datetime(readonly=True, help="The date on which the certificate starts to be valid")
    date_end = fields.Datetime(readonly=True, help="The date on which the certificate expires")
    company_id = fields.Many2one(comodel_name='res.company', required=True, default=lambda self: self.env.company)

    # -------------------------------------------------------------------------
    # HELPERS
    # -------------------------------------------------------------------------

    @api.model
    def _get_es_current_datetime(self):
        """Get the current datetime with the Peruvian timezone. """
        return datetime.now(timezone('Europe/Madrid'))

    @tools.ormcache('self.content', 'self.password')
    def _decode_certificate(self):
        """Return the content (DER encoded) and the certificate decrypted based in the point 3.1 from the RS 097-2012
        http://www.vauxoo.com/r/manualdeautorizacion#page=21
        """
        self.ensure_one()
        if self.password:
            decrypted_content = crypto.load_pkcs12(b64decode(self.content), self.password.encode())
        else:
            decrypted_content = crypto.load_pkcs12(b64decode(self.content))
        certificate = decrypted_content.get_certificate()
        private_key = decrypted_content.get_privatekey()
        pem_certificate = crypto.dump_certificate(crypto.FILETYPE_PEM, certificate)
        pem_private_key = crypto.dump_privatekey(crypto.FILETYPE_PEM, private_key)
        return pem_certificate, pem_private_key, certificate

    # -------------------------------------------------------------------------
    # LOW-LEVEL METHODS
    # -------------------------------------------------------------------------

    @api.model
    def create(self, vals):
        record = super().create(vals)

        spain_tz = timezone('America/Lima')
        spain_dt = self._get_es_current_datetime()
        date_format = '%Y%m%d%H%M%SZ'
        try:
            pem_certificate, pem_private_key, certificate = record._decode_certificate()
            cert_date_start = spain_tz.localize(datetime.strptime(certificate.get_notBefore().decode(), date_format))
            cert_date_end = spain_tz.localize(datetime.strptime(certificate.get_notAfter().decode(), date_format))
            serial_number = certificate.get_serial_number()
        except crypto.Error:
            raise ValidationError(_(
                "There has been a problem with the certificate, some usual problems can be:\n"
                "- The password given or the certificate are not valid.\n"
                "- The certificate content is invalid."
            ))
        # Assign extracted values from the certificate
        record.write({
            'serial_number': ('%x' % serial_number)[1::2],
            'date_start': fields.Datetime.to_string(cert_date_start),
            'date_end': fields.Datetime.to_string(cert_date_end),
        })
        if spain_dt > cert_date_end:
            raise ValidationError(_('The certificate is expired since %s') % record.date_end)
        return record
