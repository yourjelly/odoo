# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError
from odoo.tools.misc import format_date
from odoo.release import version


from collections import defaultdict
from pprint import pprint
from timeit import default_timer as timer
import datetime
from dateutil.relativedelta import relativedelta
import math
import json
import logging
_logger = logging.getLogger(__name__)

REFERENCE_DATE = datetime.date.min


def compute_recurence(dates, min_bin_size=0, max_bin_size=5):
    dates_diff = [dates[k + 1] - dates[k] for k in range(len(dates) - 1)]
    recurence = [defaultdict(lambda: defaultdict(lambda: 0)) for i in range(max_bin_size - min_bin_size + 1)]
    for i in range(len(dates_diff)):
        for sequence_len in range(min_bin_size, max_bin_size + 1):
            if i + sequence_len < len(dates_diff):
                sequence = tuple(dates_diff[i:i + sequence_len])
                recurence[sequence_len - min_bin_size][sequence][dates_diff[i + sequence_len]] += 1
    return recurence


def prune(recurence, min_occurence=5):
    """
    :param min_occurence: the minimum the amount of times the pattern must have appeared
    """
    tree = {}
    for rec in recurence:
        for k, v in rec.items():
            sorted = list(v.items())
            sorted.sort(key=lambda i: i[1])
            summed = sum(s[1] for s in sorted)
            max_item = sorted[-1]
            if not sorted or max_item[1] < min_occurence or max_item[1] < (summed / 2):
                continue
            tree[k] = max_item[0]
    return tree


def find(dates, tree, after=0):
    max_bin_size = max((len(i) for i in tree.keys()), default=0)
    min_bin_size = min((len(i) for i in tree.keys()), default=0)
    found = set()
    dates_set = set(dates)
    dates_diff = [dates[k + 1] - dates[k] for k in range(len(dates) - 1)]
    for i in range(len(dates_diff) + 1):
        for sequence_len in range(max_bin_size, min(i, min_bin_size), -1):
            if i - sequence_len >= 0:
                seq = dates_diff[i - sequence_len:i]
                res = tree.get(tuple(seq))
                if res:
                    add = True
                    range_res = int(res / 4)
                    for days in range(-range_res, range_res + 1):
                        if res + dates[i] + days in dates_set:
                            add = False
                            break
                    if add:
                        if dates[i] + res > after:  # TODO set the check earlier
                            found.add(dates[i] + res)
                        break
    return found


class AIWizardProposition(models.Model):
    _name = 'account.ai.finddate.line'
    _description = 'Deduced things'

    company_id = fields.Many2one(related='config_id.company_id', store=True, readonly=True)
    config_id = fields.Many2one('account.ai.config', required=True)
    account_id = fields.Many2one('account.account')
    partner_id = fields.Many2one('res.partner')
    range_up = fields.Float()
    range_down = fields.Float()
    date = fields.Date()
    date_str = fields.Char()

    def action_open(self):
        self.ensure_one()
        domain = [('account_id', '=', self.account_id.id), ('partner_id', '=', self.partner_id.id)]
        if self.range_up:
            domain += [('balance', '<=', self.range_up)]
        if self.range_down:
            domain += [('balance', '>=', self.range_down)]
        return {
            'name': "{account}, {partner} [{down},{up}], {date}".format(
                account=self.account_id.display_name,
                partner=self.partner_id.display_name,
                down=self.range_down,
                up=self.range_up,
                date=self.date_str,
            ),
            'type': 'ir.actions.act_window',
            'res_model': 'account.move.line',
            'view_mode': 'tree,form',
            'domain': domain,
        }

    def action_create(self):
        self.ensure_one()
        raise UserError("Not implemented yet, dont be greedy")


class AIConfig(models.Model):
    _name = "account.ai.config"
    _description = "Deducer Config"

    name = fields.Char(required=True)
    find = fields.Selection([
        ('date', 'Find missing documents'),
        ('amount', 'Find unusual amounts'),
        ('clear', 'Find accounts that should be cleared'),
        ('tax', 'Find accounts that should have taxes'),
        ('check', 'Find entries that should be checked'),
        ('outstanding', 'Find partners with outstanding payments'),
    ], required=True, default='date')
    action = fields.Selection([
        ('manual', 'Call manually'),
        ('accountbot', 'Ask to AccountBot to give me a reminder'),
        ('dashboard', 'Show on dashboard'),
    ], required=True, default='manual')
    account_ids = fields.Many2many('account.account')
    account_type_ids = fields.Many2many('account.account.type')
    generated_cron_id = fields.Many2one('ir.cron', readonly=True, copy=False)
    kanban_dashboard_graph = fields.Text(compute='_kanban_dashboard_graph')
    kanban_dashboard = fields.Text(compute='_kanban_dashboard')
    last_update = fields.Date()

    # find date fields
    amount_grouping = fields.Selection([
        ('amount_range', 'With range'),
        ('amount_range_sign', 'With sign'),
        ('no_amount_range', 'Without grouping')
    ], default='amount_range')
    line_ids = fields.One2many('account.ai.finddate.line', 'config_id')

    # odoobot fields
    partner_id = fields.Many2one('res.partner', string="Partner contacted by AccountBot", default=lambda self: self.env.user.partner_id)

    company_id = fields.Many2one('res.company', default=lambda self: self.env.company)

    @api.onchange('find')
    def _onchange_find(self):
        self.name = dict(self._fields['find'].selection)[self.find]

    @api.model
    def create(self, vals):
        rec = super(AIConfig, self).create(vals)
        if rec.action == 'manual':
            pass
        elif rec.action == 'accountbot':
            rec._create_cron()
        else:
            raise UserError('Action not yet implemented')
        if rec.find != 'date':
            raise UserError('For now, only finding the date is implemented; other things are just there to show a possible interface and ideas.')
        return rec

    def write(self, vals):
        super(AIConfig, self).write(vals)
        for config in self:
            if config.action == 'manual':
                if config.generated_cron_id:
                    config.generated_cron_id.unlink()
            elif config.action == 'odoobot':
                config._create_cron()

    def unlink(self):
        for config in self:
            if config.generated_cron_id:
                config.generated_cron_id.unlink()
        super(AIConfig, self).unlink()

    def _create_cron(self):
        module = 'account'
        for config in self:
            if not config.generated_cron_id:
                action = self.env['ir.actions.server'].sudo()._load_records([{
                    'xml_id': "%s.%s" % (module, 'account_ai_action_cron_' + str(config.id)),
                    'values': {
                        'name': config.display_name,
                        'model_id': self.env.ref('account.model_account_ai_config').id,
                        'usage': 'ir_cron',
                        'state': 'code',
                        'code': "action = model.browse(%s).action_run_odoo_bot()" % config.id
                    },
                    'noupdate': True,
                }])
                config.generated_cron_id = self.env['ir.cron'].create({
                    'ir_actions_server_id': action.id,
                })

    def take_action(self):
        for config in self:
            if config.find == 'date':
                config._find_date()
            else:
                raise UserError('not yet implemented')
            config.last_update = fields.Date.today()

    ############################################################################
    # FIND DATE METHODS
    ############################################################################
    def _get_dates(self, grouping='amount_range'):
        assert grouping in ('amount_range', 'amount_range_sign', 'no_amount_range')
        self.env.cr.execute("""
            WITH amount_range(amount_range) AS ( VALUES
                (int4range(NULL, -51200)),
                (int4range(-102400, -12800)),
                (int4range(-25600, -3200)),
                (int4range(-6400, -800)),
                (int4range(-1600, -200)),
                (int4range(-400, -50)),
                (int4range(-100, 0)),
                (int4range(0, 100)),
                (int4range(50, 400)),
                (int4range(200, 1600)),
                (int4range(800, 6400)),
                (int4range(3200, 25600)),
                (int4range(12800, 102400)),
                (int4range(51200, NULL))
            ),
            amount_range_sign(amount_range) AS ( VALUES
                (int4range(NULL, 0)),
                (int4range(0, NULL))
            ),
            no_amount_range(amount_range) AS ( VALUES
                (int4range(NULL, NULL))
            )
            SELECT account_id, partner_id, amount_range, array_agg(DISTINCT date ORDER BY date ASC)
            FROM account_move_line aml
            JOIN account_account account ON account.id = aml.account_id
            LEFT JOIN {grouping} ON balance::int <@ amount_range
            WHERE aml.company_id = %(company)s
            {where_account}
            {where_account_type}
            GROUP BY account_id, partner_id, amount_range
        """.format(
            grouping=grouping,
            where_account=self.account_ids and "AND account_id in %(accounts)s" or "",
            where_account_type=self.account_type_ids and "AND account.user_type_id in %(account_types)s" or "",
        ), {
            'company': self.company_id.id,
            'accounts': tuple(self.account_ids.ids),
            'account_types': tuple(self.account_type_ids.ids),
        })
        dates_grouped = self.env.cr.fetchall()
        return [
            # month granularity
            {(account, partner, (range.lower or 0, range.upper or 99999999)): [date.year * 12 + date.month - 1 for date in dates]
                for account, partner, range, dates in dates_grouped},
            # day granularity
            {(account, partner, (range.lower or 0, range.upper or 99999999)): [(date - REFERENCE_DATE).days for date in dates]
                for account, partner, range, dates in dates_grouped},
        ]

    def _find_date(self):
        def days_to_date(date):
            return REFERENCE_DATE + datetime.timedelta(date)

        def month_to_date(date):
            return datetime.datetime(date // 12 + (1 if date % 12 == 0 else 0), date % 12 + 1, 1) + relativedelta(day=31)

        for config in self:
            start = timer()
            total_algo = 0
            config.line_ids.unlink()
            lock_date = config.company_id.fiscalyear_lock_date or datetime.date.min
            dates_dict_list = config._get_dates(config.amount_grouping)
            propositions = {}
            create_set = defaultdict(list)
            for i, function_to_date, date_format in ((1, days_to_date, None), (0, month_to_date, "YYYY MMMM")):
                for key, dates in dates_dict_list[i].items():
                    start_algo = timer()
                    recurence = compute_recurence(dates, min(int(math.log10(len(dates))), 4), 10)
                    tree = prune(recurence, 2)
                    after_date = lock_date.year * 12 + lock_date.month - 1 if i == 0 else (lock_date - REFERENCE_DATE).days
                    found = find(dates, tree, after=after_date)
                    stop_algo = timer()
                    total_algo += stop_algo - start_algo
                    account_id, partner_id, range = key
                    found_dates = {function_to_date(f) for f in found}
                    for date in found_dates:
                        new_one = True
                        for similar_alert in create_set[(account_id, partner_id)]:
                            if similar_alert['date'] == date and similar_alert['range_down'] < range[0] < similar_alert['range_up'] < range[1]:
                                similar_alert['range_up'] = range[1]
                                new_one = False
                                break
                            elif similar_alert['date'] == date and range[0] < similar_alert['range_down'] < range[1] < similar_alert['range_up']:
                                similar_alert['range_down'] = range[0]
                                new_one = False
                                break
                        if new_one:
                            create_set[(account_id, partner_id)] += [{
                                'config_id': config.id,
                                'account_id': account_id,
                                'partner_id': partner_id,
                                'range_up': range[1],
                                'range_down': range[0],
                                'date': date,
                                'date_str': format_date(self.env, date, date_format=date_format),
                            }]
            self.env['account.ai.finddate.line'].create([y for x in create_set.values() for y in x])
            _logger.info('The total computation took %s seconds' % (timer() - start))
            _logger.info('The real computation took %s seconds' % (total_algo))

    ############################################################################
    # ACTIONS
    ############################################################################
    def action_get_lines(self):
        self.take_action()
        return self.action_view_lines()

    def action_view_lines(self):
        if self.find == 'date':
            return {
                'name': self.display_name,
                'res_model': 'account.ai.finddate.line',
                'view_mode': 'tree',
                'domain': [('config_id', '=', self.id)],
                'type': 'ir.actions.act_window',
                'target': 'current',
            }

    def action_run_odoo_bot(self):
        accountbot_id = self.env['ir.model.data'].xmlid_to_res_id("account.partner_accountbot")
        channel = self.env['mail.channel'].search([('channel_partner_ids', 'in', (accountbot_id, self.partner_id.id)), ('channel_type', '=', 'chat'), ('name', '=', 'AccountBot'), ('public', '=', 'private')], limit=1)
        if not channel:
            channel = self.env['mail.channel'].with_context(mail_create_nosubscribe=True).create({
                'channel_partner_ids': [(4, self.partner_id.id), (4, accountbot_id)],
                'public': 'private',
                'channel_type': 'chat',
                'email_send': False,
                'name': 'AccountBot'
            })
        self.take_action()
        body = "I am not trained for that action (yet), sorry 😞"
        if self.find == 'date':
            body = """Hello, I found %s propositions for you 😊<br>
            If you want to have a look, tell me: <b>show them</b>""" % len(self.line_ids)
        channel.with_context(mail_create_nosubscribe=True).sudo().message_post(
            body=body,
            author_id=self.env['ir.model.data'].xmlid_to_res_id("account.partner_accountbot"),
            message_type='comment',
            subtype_id=self.env['ir.model.data'].xmlid_to_res_id('mail.mt_comment')
        )

    def action_open(self):
        return {
            'name': self.display_name,
            'res_model': 'account.ai.config',
            'view_mode': 'form',
            'res_id': self.id,
            'type': 'ir.actions.act_window',
            'target': 'current',
        }

    ############################################################################
    # KANBAN METHODS
    ############################################################################
    def _kanban_dashboard(self):
        for config in self:
            config.kanban_dashboard = json.dumps({
                'is_sample_data': False,
                'graph_type': 'bar',
                'action': config.action,
                'display_company': len(self.env.companies) > 1,
                'last_update': format_date(self.env, config.last_update),
            })

    @api.depends('kanban_dashboard')
    def _kanban_dashboard_graph(self):
        def build_graph_data(date, amount):
            name = format_date(self.env, date, date_format='d LLLL Y')
            short_name = format_date(self.env, date, date_format='d MMM')
            return {'value': amount, 'label': short_name, 'type': 'past'} if graph_type == 'bar' else {'x': short_name, 'y': amount, 'name': name}

        for config in self:
            today = fields.Date.today()
            graph_type = ''
            graph_key = ''
            color = '#875A7B' if 'e' in version else '#7c7bad'
            data = []
            if config.find == 'date':
                graph_type = json.loads(config.kanban_dashboard)['graph_type']
                graph_key = 'Number of propositions'
                query = """
                    SELECT date, COUNT(id)
                    FROM account_ai_finddate_line
                    WHERE config_id = %(config_id)s
                    GROUP BY date
                """
                self.env.cr.execute(query, {'config_id': config.id})
                data = [build_graph_data(x[0], x[1]) for x in self.env.cr.fetchall()]
            config.kanban_dashboard_graph = json.dumps([{'values': data, 'title': '', 'key': graph_key, 'area': True, 'color': color}])


class MailBot(models.AbstractModel):
    _inherit = 'mail.bot'

    def _apply_logic(self, record, values, command=None):
        """ Apply bot logic to generate an answer (or not) for the user
        The logic will only be applied if odoobot is in a chat with a user or
        if someone pinged odoobot.

         :param record: the mail_thread (or mail_channel) where the user
            message was posted/odoobot will answer.
         :param values: msg_values of the message_post or other values needed by logic
         :param command: the name of the called command if the logic is not triggered by a message_post
        """
        accountbot_id = self.env['ir.model.data'].xmlid_to_res_id("account.partner_accountbot")
        if record.name != 'AccountBot':
            return super(MailBot, self)._apply_logic(record, values, command)

        if len(record) != 1 or values.get("author_id") == accountbot_id:
            return
        if self._is_bot_in_private_channel(record):
            body = values.get("body", "").replace(u'\xa0', u' ').strip().lower().strip(".?!")
            answer = 'I am not yet programmed to answer to you 😱 <br>I am learning, I promise.'
            if answer:
                message_type = values.get('message_type', 'comment')
                subtype_id = values.get('subtype_id', self.env['ir.model.data'].xmlid_to_res_id('mail.mt_comment'))
                record.with_context(mail_create_nosubscribe=True).sudo().message_post(body=answer, author_id=accountbot_id, message_type=message_type, subtype_id=subtype_id)

    def _is_bot_in_private_channel(self, record):
        accountbot_id = self.env['ir.model.data'].xmlid_to_res_id("account.partner_accountbot")
        if record._name == 'mail.channel' and record.channel_type == 'chat':
            return accountbot_id in record.with_context(active_test=False).channel_partner_ids.ids
        return False
