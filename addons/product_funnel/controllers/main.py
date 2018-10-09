from odoo import http


class Products(http.Controller):
    # filter record for generate funnel chart
    @http.route('/search/product/', type="json")
    def search_data(self, search_by, name):

        records = http.request.env['product.template'].search([(name, '=', search_by)]).sorted(key=lambda x: x.qty_available)
        data = [[r.name if name == 'location_name' else r.location_name.name, r.qty_available] for r in records]
        data.reverse()

        return data

    @http.route('/list/value/', type="json")
    def list_value(self, **kw):
        product = http.request.env['product.template'].search([('location_name', '!=', False)]).mapped('name')
        location = http.request.env['product.template'].search([]).mapped('location_name.name')
        return {'product': list(set(product)), 'location': list(set(location))}
