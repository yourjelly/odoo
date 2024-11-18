from odoo.addons.portal.controllers import portal

class CustomerPortal(portal.CustomerPortal):

    def _get_mandatory_fields(self):
        return super()._get_mandatory_fields() + ['zipcode', 'vat']

    def _get_optional_fields(self):
        return [field for field in super()._get_optional_fields() if field not in ['zipcode', 'vat']]
