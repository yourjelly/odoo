# -*- encoding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Website',
    'category': 'Website/Website',
    'sequence': 20,
    'summary': 'Enterprise website builder',
    'website': 'https://www.odoo.com/page/website-builder',
    'version': '1.0',
    'description': "",
    'depends': [
        'digest',
        'web',
        'web_editor',
        'http_routing',
        'portal',
        'social_media',
        'auth_signup',
    ],
    'installable': True,
    'data': [
        'data/website_data.xml',
        'data/website_visitor_cron.xml',
        'security/website_security.xml',
        'security/ir.model.access.csv',
        'data/digest_data.xml',
        'views/assets.xml',
        'views/website_templates.xml',
        'views/website_navbar_templates.xml',
        'views/snippets/snippets.xml',
        'views/snippets/s_title.xml',
        'views/snippets/s_cover.xml',
        'views/snippets/s_text_image.xml',
        'views/snippets/s_image_text.xml',
        'views/snippets/s_banner.xml',
        'views/snippets/s_text_block.xml',
        'views/snippets/s_features.xml',
        'views/snippets/s_three_columns.xml',
        'views/snippets/s_picture.xml',
        'views/snippets/s_carousel.xml',
        'views/snippets/s_alert.xml',
        'views/snippets/s_card.xml',
        'views/snippets/s_share.xml',
        'views/snippets/s_rating.xml',
        'views/snippets/s_hr.xml',
        'views/snippets/s_facebook_page.xml',
        'views/snippets/s_image_gallery.xml',
        'views/snippets/s_countdown.xml',
        'views/snippets/s_product_catalog.xml',
        'views/snippets/s_comparisons.xml',
        'views/snippets/s_company_team.xml',
        'views/snippets/s_call_to_action.xml',
        'views/snippets/s_references.xml',
        'views/snippets/s_popup.xml',
        'views/snippets/s_faq_collapse.xml',
        'views/snippets/s_features_grid.xml',
        'views/snippets/s_tabs.xml',
        'views/snippets/s_table_of_content.xml',
        'views/snippets/s_chart.xml',
        'views/snippets/s_parallax.xml',
        'views/snippets/s_quotes_carousel.xml',
        'views/snippets/s_numbers.xml',
        'views/snippets/s_masonry_block.xml',
        'views/snippets/s_media_list.xml',
        'views/snippets/s_showcase.xml',
        'views/snippets/s_timeline.xml',
        'views/snippets/s_process_steps.xml',
        'views/snippets/s_text_highlight.xml',
        'views/snippets/s_progress_bar.xml',
        'views/snippets/s_blockquote.xml',
        'views/snippets/s_badge.xml',
        'views/snippets/s_color_blocks_2.xml',
        'views/snippets/s_product_list.xml',
        'views/snippets/s_mega_menu_multi_menus.xml',
        'views/snippets/s_mega_menu_menu_image_menu.xml',
        'views/snippets/s_google_map.xml',
        'views/snippets/s_dynamic_snippet.xml',
        'views/snippets/s_dynamic_snippet_carousel.xml',
        'views/website_views.xml',
        'views/website_visitor_views.xml',
        'views/res_config_settings_views.xml',
        'views/website_rewrite.xml',
        'views/ir_actions_views.xml',
        'views/ir_attachment_views.xml',
        'views/res_partner_views.xml',
        'wizard/base_language_install_views.xml',
        'wizard/website_robots.xml',

        # Old snippets
        
    ],
    'demo': [
        'data/website_demo.xml',
    ],
    'qweb': [
        'static/src/xml/website.backend.xml',
        'static/src/xml/website_widget.xml',
        'static/src/xml/theme_preview.xml',
    ],
    'application': True,
    'post_init_hook': 'post_init_hook',
    'uninstall_hook': 'uninstall_hook',
    'assets': {
        'website.test_bundle': [
            # new module 
            'web/static/lib/qweb/qweb2.js',
            # new module 
            'http://test.external.link/javascript1.js',
            # new module 
            'web/static/lib/jquery.ui/jquery-ui.css',
            # new module 
            'http://test.external.link/style1.css',
            # new module 
            'web/static/src/js/boot.js',
            # new module 
            'http://test.external.link/javascript2.js',
            # new module 
            'http://test.external.link/style2.css',
        ],
        'assets_snippet_s_media_list_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_media_list/000.scss',
        ],
        'assets_snippet_s_media_list_css_001': [
            # after //link[last()]
            'website/static/src/snippets/s_media_list/001.scss',
        ],
        'assets_snippet_s_color_blocks_2_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_color_blocks_2/000.scss',
        ],
        'assets_snippet_s_chart_js_000': [
            # after //script[last()]
            'website/static/src/snippets/s_chart/000.js',
        ],
        '_assets_snippet_s_masonry_block_css_000_variables': [
            # after //link[last()]
            'website/static/src/snippets/s_masonry_block/000_variables.scss',
        ],
        'assets_snippet_s_masonry_block_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_masonry_block/000.scss',
        ],
        'assets_snippet_s_masonry_block_css_001': [
            # after //link[last()]
            'website/static/src/snippets/s_masonry_block/001.scss',
        ],
        'assets_snippet_s_rating_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_rating/000.scss',
        ],
        'assets_snippet_s_rating_css_001': [
            # after //link[last()]
            'website/static/src/snippets/s_rating/001.scss',
        ],
        'assets_snippet_s_dynamic_snippet_carousel_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_dynamic_snippet_carousel/000.scss',
        ],
        'assets_snippet_s_dynamic_snippet_carousel_js_000': [
            # after //script[last()]
            'website/static/src/snippets/s_dynamic_snippet_carousel/000.js',
        ],
        'assets_snippet_s_references_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_references/000.scss',
        ],
        'assets_snippet_s_alert_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_alert/000.scss',
        ],
        'assets_snippet_s_title_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_title/000.scss',
        ],
        'assets_snippet_s_image_gallery_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_image_gallery/000.scss',
        ],
        'assets_snippet_s_image_gallery_css_001': [
            # after //link[last()]
            'website/static/src/snippets/s_image_gallery/001.scss',
        ],
        'assets_snippet_s_image_gallery_js_000': [
            # after //script[last()]
            'website/static/src/snippets/s_image_gallery/000.js',
        ],
        'assets_snippet_s_facebook_page_js_000': [
            # after //script[last()]
            'website/static/src/snippets/s_facebook_page/000.js',
        ],
        'assets_snippet_s_timeline_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_timeline/000.scss',
        ],
        '_assets_snippet_s_product_list_css_000_variables': [
            # after //link[last()]
            'website/static/src/snippets/s_product_list/000_variables.scss',
        ],
        'assets_snippet_s_product_list_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_product_list/000.scss',
        ],
        'assets_snippet_s_process_steps_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_process_steps/000.scss',
        ],
        'assets_snippet_s_company_team_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_company_team/000.scss',
        ],
        'assets_snippet_s_product_catalog_css_001': [
            # after //link[last()]
            'website/static/src/snippets/s_product_catalog/001.scss',
        ],
        'assets_snippet_s_three_columns_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_three_columns/000.scss',
        ],
        'assets_snippet_s_countdown_js_000': [
            # after //script[last()]
            'website/static/src/snippets/s_countdown/000.js',
        ],
        '_assets_snippet_s_badge_css_000_variables': [
            # after //link[last()]
            'website/static/src/snippets/s_badge/000_variables.scss',
        ],
        'assets_snippet_s_badge_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_badge/000.scss',
        ],
        'assets_snippet_s_dynamic_snippet_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_dynamic_snippet/000.scss',
        ],
        'assets_snippet_s_dynamic_snippet_js_000': [
            # after //script[last()]
            'website/static/src/snippets/s_dynamic_snippet/000.js',
        ],
        'assets_snippet_s_showcase_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_showcase/000.scss',
        ],
        'assets_snippet_s_showcase_css_001': [
            # after //link[last()]
            'website/static/src/snippets/s_showcase/001.scss',
        ],
        'assets_snippet_s_tabs_css_001': [
            # after //link[last()]
            'website/static/src/snippets/s_tabs/001.scss',
        ],
        'assets_snippet_s_features_grid_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_features_grid/000.scss',
        ],
        'assets_snippet_s_blockquote_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_blockquote/000.scss',
        ],
        'assets_snippet_s_card_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_card/000.scss',
        ],
        'assets_snippet_s_btn_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_btn/000.scss',
        ],
        'assets_snippet_s_table_of_content_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_table_of_content/000.scss',
        ],
        'assets_snippet_s_table_of_content_js_000': [
            # after //script[last()]
            'website/static/src/snippets/s_table_of_content/000.js',
        ],
        'assets_snippet_s_share_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_share/000.scss',
        ],
        'assets_snippet_s_share_js_000': [
            # after //script[last()]
            'website/static/src/snippets/s_share/000.js',
        ],
        'assets_snippet_s_text_highlight_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_text_highlight/000.scss',
        ],
        'assets_snippet_s_quotes_carousel_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_quotes_carousel/000.scss',
        ],
        'assets_snippet_s_quotes_carousel_css_001': [
            # after //link[last()]
            'website/static/src/snippets/s_quotes_carousel/001.scss',
        ],
        'assets_snippet_s_google_map_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_google_map/000.scss',
        ],
        'assets_snippet_s_google_map_js_000': [
            # after //script[last()]
            'website/static/src/snippets/s_google_map/000.js',
        ],
        'assets_snippet_s_popup_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_popup/000.scss',
        ],
        'assets_snippet_s_popup_css_001': [
            # after //link[last()]
            'website/static/src/snippets/s_popup/001.scss',
        ],
        'assets_snippet_s_popup_js_000': [
            # after //script[last()]
            'website/static/src/snippets/s_popup/000.js',
        ],
        'assets_snippet_s_faq_collapse_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_faq_collapse/000.scss',
        ],
        'assets_snippet_s_comparisons_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_comparisons/000.scss',
        ],
        'assets_snippet_s_hr_css_000': [
            # after //link[last()]
            'website/static/src/snippets/s_hr/000.scss',
        ],
        'option_ripple_effect': [
            # after //link[last()]
            'website/static/src/scss/options/ripple_effect.scss',
            # after //script[last()]
            'website/static/src/js/content/ripple_effect.js',
        ],
        'default_js': [

        ],
        '_assets_secondary_variables': [
            # before //link
            ('prepend', 'website/static/src/scss/secondary_variables.scss'),
        ],
        'assets_tests': [
            # inside .
            'website/static/tests/tours/reset_password.js',
            # inside .
            'website/static/tests/tours/rte.js',
            # inside .
            'website/static/tests/tours/html_editor.js',
            # inside .
            'website/static/tests/tours/restricted_editor.js',
            # inside .
            'website/static/tests/tours/dashboard_tour.js',
            # inside .
            'website/static/tests/tours/specific_website_editor.js',
            # inside .
            'website/static/tests/tours/public_user_editor.js',
            # inside .
            'website/static/tests/tours/website_navbar_menu.js',
            # inside .
            'website/static/tests/tours/snippet_version.js',
        ],
        'assets_backend': [
            # after //link[last()]
            'website/static/src/scss/website.backend.scss',
            # after //link[last()]
            'website/static/src/scss/website_visitor_views.scss',
            # after //link[last()]
            'website/static/src/scss/website.theme_install.scss',
            # after //script[last()]
            'website/static/src/js/backend/button.js',
            # after //script[last()]
            'website/static/src/js/backend/dashboard.js',
            # after //script[last()]
            'website/static/src/js/backend/res_config_settings.js',
            # after //script[last()]
            'website/static/src/js/widget_iframe.js',
            # after //script[last()]
            'website/static/src/js/theme_preview_kanban.js',
            # after //script[last()]
            'website/static/src/js/theme_preview_form.js',
        ],
        'qunit_suite': [
            # after //script[last()]
            'website/static/tests/dashboard_tests.js',
            # after //script[last()]
            'website/static/tests/website_tests.js',
        ],
        '_assets_frontend_helpers': [
            # before //link
            ('prepend', 'website/static/src/scss/bootstrap_overridden.scss'),
        ],
        'assets_frontend_compatibility_for_12_0': [
            # after //link[last()]
            'website/static/src/scss/compatibility/bs3_for_12_0.scss',
        ],
    }
}
