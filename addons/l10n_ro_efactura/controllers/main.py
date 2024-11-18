import requests

from requests_toolbelt.utils import dump
from werkzeug.urls import url_join

from odoo import _, http
from odoo.exceptions import UserError
from odoo.http import request


class L10nRoEdiController(http.Controller):

    @http.route('/l10n_ro_edi/authorize/<int:company_id>', auth="user")
    def authorize(self, company_id, **kw):
        """ Generate Authorization Token to acquire access_key for requesting Access Token """
        company = http.request.env['res.company'].browse(company_id)
        if not company.l10n_ro_edi_client_id or not company.l10n_ro_edi_client_secret:
            raise UserError(_("Client ID and Client Secret field must be filled."))

        auth_url = (f'https://logincert.anaf.ro/anaf-oauth2/v1/authorize'
                    f'?response_type=code'
                    f'&client_id={company.l10n_ro_edi_client_id}'
                    f'&redirect_uri={company.l10n_ro_edi_callback_url}'
                    f'&token_content_type=jwt')
        return request.redirect(auth_url, code=302, local=False)

    @http.route('/l10n_ro_edi/callback/<int:company_id>', type='http', auth="user")
    def callback(self, company_id, **kw):
        """ Use the acquired access_key to request access & refresh token from ANAF """
        company = http.request.env['res.company'].browse(company_id)
        access_key = kw.get('code')
        # Without certificate, ANAF won't give any access key in the callback URL's "code" parameter
        if not access_key:
            error_message = _("Access key not found. Please try again.\nResponse: %s", kw)
            company._l10n_ro_edi_log_message(error_message)
            raise UserError(error_message)

        try:
            response = requests.post(
                url='https://logincert.anaf.ro/anaf-oauth2/v1/token',
                data={
                    'grant_type': 'authorization_code',
                    'client_id': company.l10n_ro_edi_client_id,
                    'client_secret': company.l10n_ro_edi_client_secret,
                    'code': access_key,
                    'access_key': access_key,
                    'redirect_uri': company.l10n_ro_edi_callback_url,
                    'token_content_type': 'jwt',
                },
                headers={
                    'content-type': 'application/x-www-form-urlencoded',
                    'accept': 'application/json',
                    'user-agent': 'PostmanRuntime/7.29.2',
                },
                timeout=10,
            )
        except Exception as e:
            error_message = f"Request to https://logincert.anaf.ro/anaf-oauth2/v1/token failed: {str(e)}\n" \
                            f"Received access_key: {access_key}"
            company._l10n_ro_edi_log_message(error_message)
            raise UserError(error_message)

        try:
            response_json = response.json()
            company._l10n_ro_edi_process_token_response(response_json)
        except Exception as e:
            error_message = f"Error when processing the response: {str(e)}\n" \
                            f"Received access_key: {access_key}\n\n" \
                            f"{dump.dump_all(response).decode('latin-1')}"
            company._l10n_ro_edi_log_message(error_message)
            raise UserError(error_message)

        return request.redirect(url_join(request.httprequest.url_root, 'web'))
