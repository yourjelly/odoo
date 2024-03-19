from . import models

def post_init_hook(env):

    if env.get('account_peppol.service') is not None:
        env['account_edi_proxy_client.user']._peppol_auto_register_services('l10n_jp_ubl_pint')

def uninstall_hook(env):

    unsupported_identifiers = [
        'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:fdc:peppol:jp:billing:3.0::2.1',
    ]
    if env.get('account_peppol.service') is not None:
        env['account_edi_proxy_client.user']._peppol_auto_deregister_services(unsupported_identifiers)
    return
