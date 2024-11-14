from markupsafe import Markup

from odoo import api, fields, models
from odoo.addons.mail.tools.discuss import Store


class DiscussPoll(models.Model):
    _name = "discuss.poll"
    _inherit = ["bus.listener.mixin"]

    message_id = fields.Many2one("mail.message", ondelete="cascade", required=True)
    end_message_id = fields.Many2one("mail.message", ondelete="cascade")
    question = fields.Char(required=True)
    answer_ids = fields.One2many("discuss.poll.answer", "poll_id")
    duration = fields.Integer(required=True)
    closed = fields.Boolean()
    number_of_votes = fields.Integer(compute="_compute_number_of_votes")
    winning_answer_id = fields.One2many(
        "discuss.poll.answer", "poll_id", compute="_compute_winning_answer"
    )

    @api.depends("answer_ids.voting_partner_ids")
    def _compute_number_of_votes(self):
        for poll in self:
            poll.number_of_votes = sum(len(answer.voting_partner_ids) for answer in poll.answer_ids)

    @api.depends("closed")
    def _compute_winning_answer(self):
        for poll in self:
            if not poll.answer_ids.voting_partner_ids or not poll.closed:
                poll.winning_answer_id = None
                continue
            max_vote = max(answer.percent_votes for answer in poll.answer_ids)
            winners = [answer for answer in poll.answer_ids if answer.percent_votes == max_vote]
            poll.winning_answer_id = winners[0] if len(winners) == 1 else None

    @api.model
    def _to_store(self, store: Store, /, *, fields=None, **kwargs):
        if fields is None:
            fields = [
                "answer_ids",
                "closed",
                "create_date",
                "duration",
                "message_id",
                "question",
                "winning_answer_id",
                "end_message_id",
                "number_of_votes",
            ]
        for poll in self:
            data = poll._read_format(
                [f for f in fields if f not in {"message_id", "answer_ids", "winning_answer_id"}],
                load=False,
            )[0]
            if "message_id" in fields:
                data["message_id"] = poll.message_id.id
            if "end_message_id" in fields:
                data["end_message_id"] = poll.end_message_id.id
            if "answer_ids" in fields:
                data["answer_ids"] = Store.many(poll.answer_ids)
            if "winning_answer_id" in fields and poll.winning_answer_id:
                data["winning_answer_id"] = Store.one(poll.winning_answer_id)
            store.add("discuss.poll", data)

    def _bus_channel(self):
        return self.env["discuss.channel"].browse(self.message_id.res_id)._bus_channel()

    @api.model
    def _end_expired_polls(self):
        self.env.cr.execute("""
            SELECT id
              FROM discuss_poll
             WHERE closed = FALSE
        """)
        # AND (create_date + (duration * INTERVAL '1 hour')) < NOW();
        expired_polls = self.env["discuss.poll"].browse([r[0] for r in self.env.cr.fetchall()])
        expired_polls.closed = True
        expired_polls._bus_send_store(expired_polls)
        for poll in expired_polls:
            poll_link = Markup('<a href="#" data-oe-type="highlight" data-oe-id="%s">%s</a>') % (
                poll.message_id.id,
                poll.question,
            )
            notification_text = (
                Markup("""<div class="o_mail_notification">%s</div>""")
                % self.env._(
                    "%(author_name)s's poll %(poll_link)s has closed",
                )
                % {
                    "author_name": poll.message_id.author_id.name,
                    "poll_link": poll_link,
                }
            )
            poll.end_message_id = (
                self.env["discuss.channel"]
                .browse(poll.message_id.res_id)
                .message_post(
                    author_id=poll.message_id.author_id.id,
                    message_type="notification",
                    subtype_xmlid="mail.mt_comment",
                    body=notification_text,
                )
            )
