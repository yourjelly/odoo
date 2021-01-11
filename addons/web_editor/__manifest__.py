# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Web Editor',
    'category': 'Hidden',
    'description': """
Odoo Web Editor widget.
==========================

    """,
    'depends': ['web'],
    'data': [
        'security/ir.model.access.csv',
        'data/editor_assets.xml',
        'views/editor.xml',
        'views/snippets.xml',
    ],
    'assets': {

        #----------------------------------------------------------------------
        # MAIN BUNDLES
        #----------------------------------------------------------------------

        'assets_qweb': [
            'web_editor/static/src/xml/*.xml',
        ],
        'assets_wysiwyg': [
            ('include', 'assets_summernote'),

            # lib
            'web_editor/static/lib/cropperjs/cropper.css',
            'web_editor/static/lib/cropperjs/cropper.js',
            'web_editor/static/lib/jquery-cropper/jquery-cropper.js',
            'web_editor/static/lib/jQuery.transfo.js',
            'web/static/lib/nearest/jquery.nearest.js',
            'web_editor/static/lib/webgl-image-filter/webgl-image-filter.js',

            # odoo utils
            ('include', '_assets_helpers'),

            'web_editor/static/src/scss/bootstrap_overridden.scss',
            'web/static/lib/bootstrap/scss/_variables.scss',

            # integration
            'web_editor/static/src/scss/wysiwyg.scss',
            'web_editor/static/src/scss/wysiwyg_iframe.scss',
            'web_editor/static/src/scss/wysiwyg_snippets.scss',

            'web_editor/static/src/js/wysiwyg/fonts.js',
            'web_editor/static/src/js/base.js',
            'web_editor/static/src/js/editor/editor.js',
            'web_editor/static/src/js/editor/rte.js',
            'web_editor/static/src/js/editor/rte.summernote.js',
            'web_editor/static/src/js/editor/image_processing.js',

            # widgets & plugins
            'web_editor/static/src/js/wysiwyg/widgets/**/*',
            'web_editor/static/src/js/editor/snippets.editor.js',
            'web_editor/static/src/js/editor/snippets.options.js',

            # Launcher
            'web_editor/static/src/js/wysiwyg/wysiwyg.js',
            'web_editor/static/src/js/wysiwyg/wysiwyg_snippets.js',
            'web_editor/static/src/js/wysiwyg/wysiwyg_iframe.js',
        ],
        'assets_summernote': [
            'web_editor/static/lib/summernote/src/js/summernote_import_start.js',

            'web_editor/static/lib/summernote/src/css/**/*',
            'web_editor/static/lib/summernote/src/js/core/async.js',
            'web_editor/static/lib/summernote/src/js/core/func.js',
            'web_editor/static/lib/summernote/src/js/core/agent.js',
            'web_editor/static/lib/summernote/src/js/core/list.js',
            'web_editor/static/lib/summernote/src/js/core/dom.js',
            'web_editor/static/lib/summernote/src/js/core/key.js',
            'web_editor/static/lib/summernote/src/js/core/range.js',
            'web_editor/static/lib/summernote/src/js/editing/Bullet.js',
            'web_editor/static/lib/summernote/src/js/editing/History.js',
            'web_editor/static/lib/summernote/src/js/editing/Style.js',
            'web_editor/static/lib/summernote/src/js/editing/Table.js',
            'web_editor/static/lib/summernote/src/js/editing/Typing.js',
            'web_editor/static/lib/summernote/src/js/module/Editor.js',
            'web_editor/static/lib/summernote/src/js/module/Button.js',
            'web_editor/static/lib/summernote/src/js/module/Clipboard.js',
            'web_editor/static/lib/summernote/src/js/module/Codeview.js',
            'web_editor/static/lib/summernote/src/js/module/DragAndDrop.js',
            'web_editor/static/lib/summernote/src/js/module/Fullscreen.js',
            'web_editor/static/lib/summernote/src/js/module/Handle.js',
            'web_editor/static/lib/summernote/src/js/module/HelpDialog.js',
            'web_editor/static/lib/summernote/src/js/module/ImageDialog.js',
            'web_editor/static/lib/summernote/src/js/module/LinkDialog.js',
            'web_editor/static/lib/summernote/src/js/module/Popover.js',
            'web_editor/static/lib/summernote/src/js/module/Statusbar.js',
            'web_editor/static/lib/summernote/src/js/module/Toolbar.js',
            'web_editor/static/lib/summernote/src/js/Renderer.js',
            'web_editor/static/lib/summernote/src/js/EventHandler.js',
            'web_editor/static/lib/summernote/src/js/defaults.js',
            'web_editor/static/lib/summernote/src/js/summernote.js',

            'web_editor/static/lib/summernote/src/js/summernote_import_end.js',
            'web_editor/static/src/js/editor/summernote.js',
        ],
        'assets_common': [
            'web_editor/static/lib/vkbeautify/**/*',
            'web_editor/static/src/js/common/**/*',
            'web_editor/static/src/js/wysiwyg/root.js',
        ],
        'assets_backend': [
            'web_editor/static/src/scss/web_editor.common.scss',
            'web_editor/static/src/scss/web_editor.backend.scss',

            'web_editor/static/src/js/backend/**/*',
        ],
        'assets_frontend_minimal_scripts': [
            'web_editor/static/src/js/frontend/loader_loading.js',
        ],
        'assets_frontend': [
            'web_editor/static/src/scss/web_editor.common.scss',
            'web_editor/static/src/scss/web_editor.frontend.scss',

            'web_editor/static/src/js/frontend/loader.js',
        ],

        #----------------------------------------------------------------------
        # SUB BUNDLES
        #----------------------------------------------------------------------

        '_assets_primary_variables': [
            'web_editor/static/src/scss/web_editor.variables.scss',
        ],
        '_assets_secondary_variables': [
            'web_editor/static/src/scss/secondary_variables.scss',
        ],
        '_assets_backend_helpers': [
            'web_editor/static/src/scss/bootstrap_overridden_backend.scss',
            'web_editor/static/src/scss/bootstrap_overridden.scss',
        ],
        '_assets_frontend_helpers': [
            'web_editor/static/src/scss/bootstrap_overridden.scss',
        ],

        # ----------------------------------------------------------------------
        # TESTS BUNDLES
        # ----------------------------------------------------------------------

        'qunit_suite_tests': [
            'web_editor/static/src/js/wysiwyg/root_test.js',

            ('include', 'assets_wysiwyg'),

            'web_editor/static/tests/**/*',
        ],
    },
    'auto_install': True
}
