# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from werkzeug import urls

from odoo import api, fields, models
from odoo.http import request
from odoo.tools.json import scriptsafe as json_scriptsafe


class ServerAction(models.Model):
    """ Add website option in server actions. """

    _name = 'ir.actions.server'
    _inherit = 'ir.actions.server'

    xml_id = fields.Char('External ID', compute='_compute_xml_id', help="ID of the action if defined in a XML file")
    expose = fields.Selection(selection_add=[("website", "Expose on website")])

    def _compute_xml_id(self):
        res = self.get_external_id()
        for action in self:
            action.xml_id = res.get(action.id)

    def _compute_website_url(self, website_path, xml_id):
        base_url = self.get_base_url()
        link = website_path or xml_id or (self.id and '%d' % self.id) or ''
        if base_url and link:
            path = '%s/%s' % ('/website/action', link)
            return urls.url_join(base_url, path)
        return ''

    @api.depends('xml_id')
    def _compute_url(self):
        super()._compute_url()
        for action in self:
            if action.state == 'code' and action.expose == "website":
                action.url = action._compute_website_url(action.url_path, action.xml_id)

    @api.model
    def _get_eval_context(self, action):
        """ Override to add the request object in eval_context. """
        eval_context = super(ServerAction, self)._get_eval_context(action)
        if action.state == 'code':
            eval_context['request'] = request
            eval_context['json'] = json_scriptsafe
        return eval_context

    @api.model
    def _run_action_code_multi(self, eval_context=None):
        """ Override to allow returning response the same way action is already
            returned by the basic server action behavior. Note that response has
            priority over action, avoid using both.
        """
        res = super(ServerAction, self)._run_action_code_multi(eval_context)
        return eval_context.get('response', res)
