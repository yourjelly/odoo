import ast

import werkzeug

from odoo.addons.http_routing.models.ir_http import slug, unslug
from odoo.http import Controller, request, route
from odoo.osv.expression import AND


def get_relevant_field_among(names, fields):
    return next(iter([f for f in names if f in fields]))

class ManualModelsController(Controller):

    @route([
        "/model/<string:page_name_slugified>",
        "/model/<string:page_name_slugified>/page/<int:page_number>",
        "/model/<string:page_name_slugified>/<string:record_slug>",
    ], website=True, auth="public")
    def generic_manual_model(self, page_name_slugified=None, page_number=1, record_slug=None, **searches):
        if not page_name_slugified:
            raise werkzeug.exceptions.NotFound()

        env = request.env
        website = request.website

        page_type = "listing"
        if record_slug is not None:
            page_type = "single"

        website_page_domain = AND([
            [("page_type", "=", page_type)],
            [("name_slugified", "=", page_name_slugified)],
            website.website_domain(),
        ])

        page = env["website.controller.page"].sudo().search(website_page_domain, limit=1)
        if not page:
            raise werkzeug.exceptions.NotFound()

        if not page.model_id.state == "manual":
            raise werkzeug.exceptions.NotFound()

        view = page.view_id
        if not view:
            raise werkzeug.exceptions.NotFound()

        target_model_name = page.model_id.model
        model_sudo = env[target_model_name].sudo()
        rec_domain = ast.literal_eval(page.record_domain or "[]")

        fields = model_sudo._fields
        domains = [rec_domain]
        if "website_id" in fields:
            domains.append(website.website_domain())
        if "website_published" in fields and not request.env.user.has_group('website.group_website_designer'):
            domains.append([("website_published", "=", True)])

        if record_slug:
            _, res_id = unslug(record_slug)
            record = model_sudo.browse(res_id).filtered_domain(AND(domains))
            # We check for slug matching because we are not entirely sure
            # that we end up seeing record for the right model
            # i.e. in case of a redirect when a "single" page doesn't match the listing
            if not record.exists() or record_slug != slug(record):
                raise werkzeug.exceptions.NotFound()

            render_context = {"record": record}
            return request.render(view.key, render_context)

        layout_mode = request.session.get(f'website_{view.id}_layout_mode')
        if not layout_mode:
            layout_mode = 'grid'
            # TODO DAFL: Change the default to what we put in editor
            request.session[f'website_{view.id}_layout_mode'] = layout_mode

        step = 20
        searches.setdefault("search", "")
        searches.setdefault("order", "create_date desc")

        single_record_pages = env["website.controller.page"].sudo().search(AND([
            [("page_type", "=", "single")],
            [("model", "=", target_model_name)],
            website.website_domain(),
        ]))

        # TODO DAFL: insert unicity in (page_name_slugified,model,page_type)
        single_record_page = single_record_pages.filtered(lambda rec: rec.name_slugified == page_name_slugified)
        single_record_page = single_record_page or single_record_pages[0]

        def record_to_url(record):
            if not single_record_page:
                return None
            return single_record_page._get_page_url(single_record_page.name_slugified, slug(record))[1]

        if searches["search"]:
            name_field = next(iter([f for f in ("seo_name", "x_name", "name", "display_name") if f in fields]))
            domains.append([(name_field, "ilike", searches["search"])])

        search_count = model_sudo.search_count(AND(domains))
        pager = website.pager(
            url=f"/model/{page.name_slugified}",
            url_args=searches,
            total=search_count,
            page=page_number,
            step=step,
            scope=5,
        )

        records = model_sudo.search(AND(domains), limit=step, offset=step * (page_number-1), order=searches["order"])
        render_context = {
            "order_by": searches["order"],
            "search": searches["search"],
            "search_count": search_count,
            "pager": pager,
            "records": records,
            "record_to_url": record_to_url,
            "layout_mode": layout_mode,
            "view_id": view.id,
        }
        return request.render(view.key, render_context)
