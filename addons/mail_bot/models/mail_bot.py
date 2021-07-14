# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import itertools
import random

from odoo import models, _


class MailBot(models.AbstractModel):
    _name = "mail.bot"
    _description = "Mail Bot"

    def _apply_logic(self, record, values, command=None):
        """ Apply bot logic to generate an answer (or not) for the user
        The logic will only be applied if odoobot is in a chat with a user or
        if someone pinged odoobot.

         :param record: the mail_thread (or mail_channel) where the user
            message was posted/odoobot will answer.
         :param values: msg_values of the message_post or other values needed by logic
         :param command: the name of the called command if the logic is not triggered by a message_post
        """
        odoobot_id = self.env["ir.model.data"].xmlid_to_res_id("base.partner_root")
        if len(record) != 1 or values.get("author_id") == odoobot_id:
            return
        if self._is_bot_pinged(values) or self._is_bot_in_private_channel(record):
            body = (
                values.get("body", "")
                .replace(u"\xa0", u" ")
                .strip()
                .lower()
                .strip(".!")
            )
            answer = self._get_answer(record, body, values, command)
            if answer:
                message_type = values.get("message_type", "comment")
                subtype_id = values.get(
                    "subtype_id",
                    self.env["ir.model.data"].xmlid_to_res_id("mail.mt_comment"),
                )
                record.with_context(mail_create_nosubscribe=True).sudo().message_post(
                    body=answer,
                    author_id=odoobot_id,
                    message_type=message_type,
                    subtype_id=subtype_id,
                )

    def _get_answer(self, record, body, values, command=False):
        # onboarding
        odoobot_state = self.env.user.odoobot_state
        if self._is_bot_in_private_channel(record):
            # main flow
            if odoobot_state == "onboarding_emoji" and self._body_contains_emoji(body):
                self.env.user.odoobot_state = "onboarding_command"
                self.env.user.odoobot_failed = False
                return _(
                    'Great! 👍<br/>To access special commands, <b>start your sentence with</b> <span class="o_odoobot_command">/</span>. Try getting help.'
                )
            elif odoobot_state == "onboarding_command" and command == "help":
                self.env.user.odoobot_state = "onboarding_ping"
                self.env.user.odoobot_failed = False
                return _(
                    'Wow you are a natural!<br/>Ping someone with @username to grab their attention. <b>Try to ping me using</b> <span class="o_odoobot_command">@OdooBot</span> in a sentence.'
                )
            elif odoobot_state == "onboarding_ping" and self._is_bot_pinged(values):
                self.env.user.odoobot_state = "onboarding_attachement"
                self.env.user.odoobot_failed = False
                return _(
                    "Yep, I am here! 🎉 <br/>Now, try <b>sending an attachment</b>, like a picture of your cute dog..."
                )
            elif odoobot_state == "onboarding_attachement" and values.get(
                "attachment_ids"
            ):
                self.env.user.odoobot_state = "idle"
                self.env.user.odoobot_failed = False
                return _(
                    "I am a simple bot, but if that's a dog, he is the cutest 😊 <br/>Congratulations, you finished this tour. You can now <b>close this chat window</b>. Enjoy discovering Odoo."
                )
            elif odoobot_state in (False, "idle", "not_initialized") and (
                _("start the tour") in body.lower()
            ):
                self.env.user.odoobot_state = "onboarding_emoji"
                return _("To start, try to send me an emoji :)")
            # easter eggs
            elif odoobot_state == "idle" and body in ["❤️", _("i love you"), _("love")]:
                return _(
                    "Aaaaaw that's really cute but, you know, bots don't work that way. You're too human for me! Let's keep it professional ❤️"
                )
            elif _("fuck") in body or "fuck" in body:
                return _("That's not nice! I'm a bot but I have feelings... 💔")
            # help message
            elif self._is_help_requested(body) or odoobot_state == "idle":
                return _(
                    "Unfortunately, I'm just a bot 😞 I don't understand! If you need help discovering our product, please check "
                    '<a href="https://www.odoo.com/documentation" target="_blank">our documentation</a> or '
                    '<a href="https://www.odoo.com/slides" target="_blank">our videos</a>.'
                )
            else:
                # repeat question
                if odoobot_state == "onboarding_emoji":
                    self.env.user.odoobot_failed = True
                    return _(
                        'Not exactly. To continue the tour, send an emoji: <b>type</b> <span class="o_odoobot_command">:)</span> and press enter.'
                    )
                elif odoobot_state == "onboarding_attachement":
                    self.env.user.odoobot_failed = True
                    return _(
                        'To <b>send an attachment</b>, click on the <i class="fa fa-paperclip" aria-hidden="true"></i> icon and select a file.'
                    )
                elif odoobot_state == "onboarding_command":
                    self.env.user.odoobot_failed = True
                    return _(
                        'Not sure what you are doing. Please, type <span class="o_odoobot_command">/</span> and wait for the propositions. Select <span class="o_odoobot_command">help</span> and press enter'
                    )
                elif odoobot_state == "onboarding_ping":
                    self.env.user.odoobot_failed = True
                    return _(
                        'Sorry, I am not listening. To get someone\'s attention, <b>ping him</b>. Write <span class="o_odoobot_command">@OdooBot</span> and select me.'
                    )
                return random.choice(
                    [
                        _(
                            'I\'m not smart enough to answer your question.<br/>To follow my guide, ask: <span class="o_odoobot_command">start the tour</span>.'
                        ),
                        _("Hmmm..."),
                        _("I'm afraid I don't understand. Sorry!"),
                        _(
                            "Sorry I'm sleepy. Or not! Maybe I'm just trying to hide my unawareness of human language...<br/>I can show you features if you write: <span class=\"o_odoobot_command\">start the tour</span>."
                        ),
                    ]
                )
        return False

    def _body_contains_emoji(self, body):
        # coming from https://unicode.org/emoji/charts/full-emoji-list.html
        emoji_list = itertools.chain(
            range(0x231A, 0x231C),
            range(0x23E9, 0x23F4),
            range(0x23F8, 0x23FB),
            range(0x25AA, 0x25AC),
            range(0x25FB, 0x25FF),
            range(0x2600, 0x2605),
            range(0x2614, 0x2616),
            range(0x2622, 0x2624),
            range(0x262E, 0x2630),
            range(0x2638, 0x263B),
            range(0x2648, 0x2654),
            range(0x265F, 0x2661),
            range(0x2665, 0x2667),
            range(0x267E, 0x2680),
            range(0x2692, 0x2698),
            range(0x269B, 0x269D),
            range(0x26A0, 0x26A2),
            range(0x26AA, 0x26AC),
            range(0x26B0, 0x26B2),
            range(0x26BD, 0x26BF),
            range(0x26C4, 0x26C6),
            range(0x26D3, 0x26D5),
            range(0x26E9, 0x26EB),
            range(0x26F0, 0x26F6),
            range(0x26F7, 0x26FB),
            range(0x2708, 0x270A),
            range(0x270A, 0x270C),
            range(0x270C, 0x270E),
            range(0x2733, 0x2735),
            range(0x2753, 0x2756),
            range(0x2763, 0x2765),
            range(0x2795, 0x2798),
            range(0x2934, 0x2936),
            range(0x2B05, 0x2B08),
            range(0x2B1B, 0x2B1D),
            range(0x1F170, 0x1F172),
            range(0x1F191, 0x1F19B),
            range(0x1F1E6, 0x1F200),
            range(0x1F201, 0x1F203),
            range(0x1F232, 0x1F23B),
            range(0x1F250, 0x1F252),
            range(0x1F300, 0x1F321),
            range(0x1F324, 0x1F32D),
            range(0x1F32D, 0x1F330),
            range(0x1F330, 0x1F336),
            range(0x1F337, 0x1F37D),
            range(0x1F37E, 0x1F380),
            range(0x1F380, 0x1F394),
            range(0x1F396, 0x1F398),
            range(0x1F399, 0x1F39C),
            range(0x1F39E, 0x1F3A0),
            range(0x1F3A0, 0x1F3C5),
            range(0x1F3C6, 0x1F3CB),
            range(0x1F3CB, 0x1F3CF),
            range(0x1F3CF, 0x1F3D4),
            range(0x1F3D4, 0x1F3E0),
            range(0x1F3E0, 0x1F3F1),
            range(0x1F3F3, 0x1F3F6),
            range(0x1F3F8, 0x1F400),
            range(0x1F400, 0x1F43F),
            range(0x1F442, 0x1F4F8),
            range(0x1F4F9, 0x1F4FD),
            range(0x1F500, 0x1F53E),
            range(0x1F549, 0x1F54B),
            range(0x1F54B, 0x1F54F),
            range(0x1F550, 0x1F568),
            range(0x1F56F, 0x1F571),
            range(0x1F573, 0x1F57A),
            range(0x1F58A, 0x1F58E),
            range(0x1F595, 0x1F597),
            range(0x1F5B1, 0x1F5B3),
            range(0x1F5C2, 0x1F5C5),
            range(0x1F5D1, 0x1F5D4),
            range(0x1F5DC, 0x1F5DF),
            range(0x1F5FB, 0x1F600),
            range(0x1F601, 0x1F611),
            range(0x1F612, 0x1F615),
            range(0x1F61C, 0x1F61F),
            range(0x1F620, 0x1F626),
            range(0x1F626, 0x1F628),
            range(0x1F628, 0x1F62C),
            range(0x1F62E, 0x1F630),
            range(0x1F630, 0x1F634),
            range(0x1F635, 0x1F641),
            range(0x1F641, 0x1F643),
            range(0x1F643, 0x1F645),
            range(0x1F645, 0x1F650),
            range(0x1F680, 0x1F6C6),
            range(0x1F6CB, 0x1F6D0),
            range(0x1F6D1, 0x1F6D3),
            range(0x1F6E0, 0x1F6E6),
            range(0x1F6EB, 0x1F6ED),
            range(0x1F6F4, 0x1F6F7),
            range(0x1F6F7, 0x1F6F9),
            range(0x1F910, 0x1F919),
            range(0x1F919, 0x1F91F),
            range(0x1F920, 0x1F928),
            range(0x1F928, 0x1F930),
            range(0x1F931, 0x1F933),
            range(0x1F933, 0x1F93B),
            range(0x1F93C, 0x1F93F),
            range(0x1F940, 0x1F946),
            range(0x1F947, 0x1F94C),
            range(0x1F94D, 0x1F950),
            range(0x1F950, 0x1F95F),
            range(0x1F95F, 0x1F96C),
            range(0x1F96C, 0x1F971),
            range(0x1F973, 0x1F977),
            range(0x1F97C, 0x1F980),
            range(0x1F980, 0x1F985),
            range(0x1F985, 0x1F992),
            range(0x1F992, 0x1F998),
            range(0x1F998, 0x1F9A3),
            range(0x1F9B0, 0x1F9BA),
            range(0x1F9C1, 0x1F9C3),
            range(0x1F9D0, 0x1F9E7),
            range(0x1F9E7, 0x1FA00),
            [
                0x2328,
                0x23CF,
                0x24C2,
                0x25B6,
                0x25C0,
                0x260E,
                0x2611,
                0x2618,
                0x261D,
                0x2620,
                0x2626,
                0x262A,
                0x2640,
                0x2642,
                0x2663,
                0x2668,
                0x267B,
                0x2699,
                0x26C8,
                0x26CE,
                0x26CF,
                0x26D1,
                0x26FD,
                0x2702,
                0x2705,
                0x270F,
                0x2712,
                0x2714,
                0x2716,
                0x271D,
                0x2721,
                0x2728,
                0x2744,
                0x2747,
                0x274C,
                0x274E,
                0x2757,
                0x27A1,
                0x27B0,
                0x27BF,
                0x2B50,
                0x2B55,
                0x3030,
                0x303D,
                0x3297,
                0x3299,
                0x1F004,
                0x1F0CF,
                0x1F17E,
                0x1F17F,
                0x1F18E,
                0x1F21A,
                0x1F22F,
                0x1F321,
                0x1F336,
                0x1F37D,
                0x1F3C5,
                0x1F3F7,
                0x1F43F,
                0x1F440,
                0x1F441,
                0x1F4F8,
                0x1F4FD,
                0x1F4FF,
                0x1F57A,
                0x1F587,
                0x1F590,
                0x1F5A4,
                0x1F5A5,
                0x1F5A8,
                0x1F5BC,
                0x1F5E1,
                0x1F5E3,
                0x1F5E8,
                0x1F5EF,
                0x1F5F3,
                0x1F5FA,
                0x1F600,
                0x1F611,
                0x1F615,
                0x1F616,
                0x1F617,
                0x1F618,
                0x1F619,
                0x1F61A,
                0x1F61B,
                0x1F61F,
                0x1F62C,
                0x1F62D,
                0x1F634,
                0x1F6D0,
                0x1F6E9,
                0x1F6F0,
                0x1F6F3,
                0x1F6F9,
                0x1F91F,
                0x1F930,
                0x1F94C,
                0x1F97A,
                0x1F9C0,
            ],
        )
        if any(chr(emoji) in body for emoji in emoji_list):
            return True
        return False

    def _is_bot_pinged(self, values):
        odoobot_id = self.env["ir.model.data"].xmlid_to_res_id("base.partner_root")
        return odoobot_id in values.get("partner_ids", [])

    def _is_bot_in_private_channel(self, record):
        odoobot_id = self.env["ir.model.data"].xmlid_to_res_id("base.partner_root")
        if record._name == "mail.channel" and record.channel_type == "chat":
            return (
                odoobot_id
                in record.with_context(active_test=False).channel_partner_ids.ids
            )
        return False

    def _is_help_requested(self, body):
        """Returns whether a message linking to the documentation and videos
        should be sent back to the user.
        """
        return (
            any(token in body for token in ["help", _("help"), "?"])
            or self.env.user.odoobot_failed
        )
