from lxml import html
from odoo.addons.http_routing.models.ir_http import slug

from odoo.tests import HttpCase, tagged

from odoo.addons.website.controllers.model_page import ModelPageController

@tagged('post_install', '-at_install')
class TestWebsiteControllerPage(HttpCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.listing_view = cls.env["ir.ui.view"].create({
            "type": "qweb",
            "model": "res.partner",
            "arch": """<t t-call="website.layout">
                <t t-set="_activeClasses">border-primary</t>
                <div t-attf-class="listing_layout_switcher btn-group ms-3" t-att-data-active-classes="_activeClasses" t-att-data-view-id="view_id">
                    <input type="radio" class="btn-check" name="wstudio_layout" id="o_wstudio_apply_grid" value="grid" t-att-checked="'checked' if layout_mode != 'list' else None"/>
                    <label t-attf-class="btn btn-light #{_activeClasses if layout_mode != 'list' else None} o_wstudio_apply_grid" title="Grid" for="o_wstudio_apply_grid">
                        <i class="fa fa-th-large"/>
                    </label>
                    <input type="radio" class="btn-check" name="wstudio_layout" id="o_wstudio_apply_list" t-att-checked="'checked' if layout_mode == 'list' else None" value="list"/>
                    <label t-attf-class="btn btn-light #{_activeClasses if layout_mode == 'list' else None} o_wstudio_apply_list" title="List" for="o_wstudio_apply_list">
                        <i class="oi oi-view-list"/>
                    </label>
                </div>

                <div t-attf-class="row mx-n2 mt8 #{'o_website_grid' if layout_mode == 'grid' else 'o_website_list'}">
                    <t t-foreach="records" t-as="record">
                        <a class="test_record_listing" t-out="record.display_name" t-att-href="record_to_url(record)" />
                    </t>
                </div>
            </t> """
        })

        cls.listing_controller_page = cls.env["website.controller.page"].create({
            "page_name": "Exposed Model",
            "page_type": "listing",
            "view_id": cls.listing_view.id,
            "record_domain": "[('name', '=ilike', 'test_partner_%')]",
            "website_published": True,
        })

        cls.single_view = cls.env["ir.ui.view"].create({
            "type": "qweb",
            "model": "res.partner",
            "arch": """<t t-call="website.layout">
                <div class="test_record" t-out="record.display_name" />
            </t> """
        })

        cls.single_controller_page = cls.env["website.controller.page"].create({
            "page_name": "Exposed Model",
            "page_type": "single",
            "website_id": False,
            "view_id": cls.single_view.id,
            "record_domain": "[('name', '=ilike', 'test_partner_%')]",
            "website_published": True,
        })

        has_seo_name = "seo_name" in cls.env["res.partner"]._fields
        partners_to_create = []
        for i in range(2):
            values = {
                "name": f"test_partner_{i}",
                "website_published": True,
                "website_id": False,
            }
            if has_seo_name:
                values["seo_name"] = values["name"]
            partners_to_create.append(values)
        cls.exposed_partners = cls.env["res.partner"].create(partners_to_create)

    def test_expose_model(self):
        response = self.url_open(f"/model/{self.listing_controller_page.name_slugified}")
        tree = html.fromstring(response.content.decode())
        rec_nodes = tree.xpath("//a[@class='test_record_listing']")
        self.assertEqual(len(rec_nodes), 2)
        for n, partner in zip(rec_nodes, self.exposed_partners):
            self.assertEqual(n.get("href"), f"/model/{self.single_controller_page.name_slugified}/{slug(partner)}")

        response = self.url_open(f"/model/{self.single_controller_page.name_slugified}/{slug(self.exposed_partners[0])}")
        tree = html.fromstring(response.content.decode())
        self.assertEqual(len(tree.xpath("//div[@class='test_record']")), 1)

        response = self.url_open(f"/model/{self.single_controller_page.name_slugified}/fake-slug-{self.exposed_partners[0].id}")
        self.assertEqual(response.status_code, 404)

        admin_partner = self.env["res.users"].browse(2).partner_id
        response = self.url_open(f"/model/{self.single_controller_page.name_slugified}/{slug(admin_partner)}")
        self.assertEqual(response.status_code, 404)

        response = self.url_open("/model/some-other-slug")
        self.assertEqual(response.status_code, 404)

        self.listing_controller_page.website_published = False
        response = self.url_open(f"/model/{self.listing_controller_page.name_slugified}")
        self.assertEqual(response.status_code, 404)

    def test_search_listing(self):
        response = self.url_open(f"/model/{self.listing_controller_page.name_slugified}?search=1")
        tree = html.fromstring(response.content.decode())
        rec_nodes = tree.xpath("//a[@class='test_record_listing']")
        self.assertEqual(len(rec_nodes), 1)
        self.assertEqual(rec_nodes[0].get("href"), f"/model/{self.single_controller_page.name_slugified}/{slug(self.exposed_partners[1])}")

        self.patch(ModelPageController, "pager_step", 1)
        response = self.url_open(f"/model/{self.listing_controller_page.name_slugified}/page/2")
        tree = html.fromstring(response.content.decode())
        rec_nodes = tree.xpath("//a[@class='test_record_listing']")
        self.assertEqual(len(rec_nodes), 1)
        self.assertEqual(rec_nodes[0].get("href"), f"/model/{self.single_controller_page.name_slugified}/{slug(self.exposed_partners[1])}")

    def test_default_layout(self):
        self.assertEqual(self.listing_controller_page.default_layout, 'grid')
        self.start_tour('/model/exposed-model', 'website_controller_page_listing_layout', login='admin')
        self.assertEqual(self.listing_controller_page.default_layout, 'list')
        #check that the user that has not previously interacted with the layout switcher will prompt on the default layout
        self.start_tour('/model/exposed-model', 'website_controller_page_default_page_check', login='admin')
