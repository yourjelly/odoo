# -*- coding: utf-8 -*-
from odoo import models, api
from odoo.tools import misc
from lxml.builder import E


class BaseModel(models.AbstractModel):
    _inherit = 'base'

    @api.model
    def _get_default_activity_view(self):
        """ Generates an empty activity view.

        :returns: a activity view as an lxml document
        :rtype: etree._Element
        """
        field = E.field(name=self._rec_name_fallback())
        activity_box = E.div(field, {'t-name': "activity-box"})
        templates = E.templates(activity_box)
        return E.activity(templates, string=self._description)

    def _notify_email_headers(self):
        """
            Generate the email headers based on record
        """
        if not self:
            return {}
        self.ensure_one()
        return repr(self._notify_email_header_dict())

    def _notify_email_header_dict(self):
        return {
            'X-Odoo-Objects': "%s-%s" % (self._name, self.id),
        }

    def _get_record_html_link(self, fname=None, description=None, raw_description=False):
        # VFE FIXME move to orm ?
        self.ensure_one()
        description = description or self.get(fname or self._rec_name)
        if not raw_description:
            description = misc.html_escape(description)
        return "<a href=# data-oe-model=%(model)s data-oe-id=%(rec_id)s>%(description)s</a>" % {
            "model": self._name,
            "rec_id": self.id,
            "description": description,
        }
