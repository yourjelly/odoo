# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.http import request
from odoo.tools import get_lang
from werkzeug.exceptions import NotFound

def downgrade_to_public_user():
    """Replace the request user by the public one. All the cookies are removed
    in order to ensure that the no user-specific data is kept in the request."""
    public_user = request.env.ref("base.public_user")
    request.update_env(user=public_user)
    request.httprequest.cookies = {}


def force_guest_env(guest_token, raise_if_not_found=True):
    """Retrieve the guest from the given token and add it to the context.
    The request user is then replaced by the public one.

    :param str guest_token:
    :param bool raise_if_not_found: whether to raise if the guest cannot be
        found from the token
    :raise NotFound: if the guest cannot be found from the token and the
        ``raise_if_not_found`` parameter is set to ``True``
    """
    downgrade_to_public_user()
    guest = request.env["mail.guest"]._get_guest_from_token(guest_token)
    if guest:
        request.update_context(guest=guest)
    elif raise_if_not_found:
        raise NotFound()


def get_visitor_lang(request):
    if lang := request.httprequest.cookies.get("frontend_lang"):
        return lang
    if request.env.user and not request.env.user._is_public():
        return request.env.user.lang
    if request.best_lang:
        return request.env["ir.http"].get_nearest_lang(request.best_lang)
    return get_lang(request.env).code
