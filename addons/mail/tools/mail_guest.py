from datetime import datetime, timedelta
from werkzeug.exceptions import NotFound

from odoo.exceptions import UserError
from odoo.http import request
from odoo.tools.misc import get_lang


def get_current_persona_for_channel(channel, guest_name, add_as_member=True, post_joined_message=True):
    """Get the current persona for the given channel.

    :param channel: channel to add the persona to
    :param guest_name: name of the persona
    :param add_as_member: whether to add the persona as a member of the channel
    :param post_joined_message: whether to post a message to the channel
        to notify that the persona joined
    :return tuple(guest, partner):
    """
    guest = None
    member = channel.env["discuss.channel.member"]._get_as_sudo_from_context(channel_id=channel.id)
    if member:
        return member.guest_id, member.partner_id
    if not channel.env.user._is_public() and add_as_member:
        try:
            channel.add_members([channel.env.user.partner_id.id], post_joined_message=post_joined_message)
        except UserError:
            raise NotFound()
    elif channel.env.user._is_public():
        is_guest_known = bool(channel.env["mail.guest"]._get_guest_from_context())
        country_id = channel.env["res.country"].search([("code", "=", request.geoip.country_code)], limit=1).id
        timezone = channel.env["mail.guest"]._get_timezone_from_request(request)
        guest = get_guest_for_channel(
            channel=channel,
            guest_name=guest_name,
            country_id=country_id,
            timezone=timezone,
            add_as_member=add_as_member,
            post_joined_message=post_joined_message,
        )
        if not is_guest_known:
            add_guest_cookie(guest)
    return guest, request.env.user.partner_id if not guest else None


def get_guest_for_channel(channel, guest_name, country_id, timezone, add_as_member=True, post_joined_message=False):
    """Get a guest for the given channel. If there is no guest yet,
    create one.

    :param channel: channel to add the guest to
    :param guest_name: name of the guest
    :param country_id: country of the guest
    :param timezone: timezone of the guest
    :param add_as_member: whether to add the guest as a member of the channel
    :param post_joined_message: whether to post a message to the channel
        to notify that the guest joined
    """
    if channel.group_public_id:
        raise NotFound()
    guest = channel.env["mail.guest"]._get_guest_from_context()
    if not guest:
        guest = channel.env["mail.guest"].create(
            {
                "country_id": country_id,
                "lang": get_lang(channel.env).code,
                "name": guest_name,
                "timezone": timezone,
            }
        )
    if add_as_member:
        channel = channel.with_context(guest=guest)
        try:
            channel.add_members(guest_ids=[guest.id], post_joined_message=post_joined_message)
        except UserError:
            raise NotFound()
    return guest


def add_guest_cookie(guest):
    """Add a cookie to the response to identify the guest. Every route
    that expects a guest will make use of it to authenticate the guest
    through `_get_as_sudo_from_context` or `_get_as_sudo_from_context_or_raise`.
    :param guest: guest to add the cookie for
    """
    expiration_date = datetime.now() + timedelta(days=365)
    request.future_response.set_cookie(
        guest._cookie_name,
        f"{guest.id}{guest._cookie_separator}{guest.access_token}",
        httponly=True,
        expires=expiration_date,
    )
