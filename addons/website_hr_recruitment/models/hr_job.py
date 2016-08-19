# -*- coding: utf-8 -*-

from openerp.osv import osv, fields
from openerp.tools.translate import html_translate

class hr_job(osv.osv):
    _name = 'hr.job'
    _inherit = ['hr.job', 'website.seo.metadata', 'website.published.mixin']

    def _website_url(self, cr, uid, ids, field_name, arg, context=None):
        res = super(hr_job, self)._website_url(cr, uid, ids, field_name, arg, context=context)
        for job in self.browse(cr, uid, ids, context=context):
            res[job.id] = "/jobs/detail/%s" % job.id
        return res

    def set_open(self, cr, uid, ids, context=None):
        self.write(cr, uid, ids, {'website_published': False}, context=context)
        return super(hr_job, self).set_open(cr, uid, ids, context)

    def _get_default_website_description(self, cr, uid, context=None):
        IrModelData = self.pool.get('ir.model.data')
        default_description = IrModelData.xmlid_to_object(cr, uid, 'website_hr_recruitment.default_website_description', context=context)
        if default_description: 
            return self.pool.get('ir.ui.view').render(cr, uid, default_description.id, context=context)
        else:
            return ''

    _columns = {
        'website_description': fields.html('Website description', translate=html_translate, sanitize=False),
    }

    _defaults = {
        'website_description': _get_default_website_description,
    }