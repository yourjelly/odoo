# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from zeep import Client
from odoo.modules.module import get_resource_path

import base64


class SdlCoopRequest(object):

    def __init__(self,):
        wsdl_path = get_resource_path('l10n_it_edi', 'api', 'SdIRiceviFile_v1.0.wsdl')
        self.client = Client('file:///%s' % wsdl_path)

    #TODO CARVAJAL
    def upload(self, filename, xml):
        '''Upload an XML to carvajal.

        :returns:        A dictionary.
        * message:       Message from carvajal.
        * transactionId: The Carvajal ID of this request.
        * error:         An eventual error.
        * error_level:   Info, warning, error.
        '''
        try:
            print('before request')
            response = self.client.service.RiceviFile(NomeFile=filename, File=base64.encodebytes(xml))
            print('after request')
        except Exception as e:
            return print(e)

        return {
            'transactionId': response.IdentificativoSdI,
            'error': response.Error,
        }
