/** @odoo-module **/

export function getWysiwygIframeContent(params) {
    const assets = {
        cssLibs: [],
        cssContents: [],
        jsLibs: [],
        jsContents: [],
    };
    for (const asset of params.assets) {
        for (const cssLib of asset.cssLibs) {
            assets.cssLibs.push(`<link type="text/css" rel="stylesheet" href="${cssLib}"/>`);
        }
        for (const cssContent of asset.cssContents) {
            assets.cssContents.push(`<style type="text/css">${cssContent}</style>`);
        }
        for (const jsLib of asset.jsLibs) {
            assets.jsLibs.push(`<script type="text/javascript" src="${jsLib}"/>`);
        }
        for (const jsContent of asset.jsContents) {
            if (jsContent.indexOf('inline asset') !== -1) {
                assets.jsContents.push(`<script type="text/javascript">${jsContent}</script>`);
            }
        }
    }
    return `
        <meta charset="utf-8"/>
        <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
        <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no"/>
        ${assets.cssLibs.join('\n')}
        ${assets.cssContents.join('\n')}
        ${assets.jsLibs.join('\n')}
        ${assets.jsContents.join('\n')}

        <script type="text/javascript">
            odoo.define('web.session', [], function () {
                return window.top.odoo.__DEBUG__.services['web.session'];
            });

            odoo.define('root.widget', ['web.Widget'], function (require) {
                'use strict';
                var Widget = require('web.Widget');
                var widget = new Widget();
                widget.appendTo(document.body);
                return widget;
            });

            odoo.define('web.core.top', ['web.core'], function (require) {
                var core = require('web.core');
                core.qweb.templates = window.top.odoo.__DEBUG__.services['web.core'].qweb.templates;
            });
        </script>
    </head>
    <body class="o_in_iframe">
        <div id="iframe_target"/>
        <script type="text/javascript">
            odoo.define('web_editor.wysiwyg.iniframe', [], function (require) {
                'use strict';
                if (window.top.${params.updateIframeId}) {
                    window.top.${params.updateIframeId}(${params.avoidDoubleLoad});
                }
            });
        </script>
    </body>`;
}
