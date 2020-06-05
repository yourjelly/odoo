odoo.define('web_editor.loader', function (require) {
'use strict';

var ajax = require('web.ajax');

function waitTimeout(ms) {
    return new Promise((resolve)=>{
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

/**
 * Load the assets and create a wysiwyg.
 *
 * @param {Widget} parent The wysiwyg parent
 * @param {object} options The wysiwyg options
 */
async function createWysiwyg(parent, options, additionnalAssets = []) {
    await ajax.loadLibs({assetLibs: ['web_editor.compiled_assets_wysiwyg', ...additionnalAssets]});
    // todo: find why the service is not yet ready than remove this function
    await waitTimeout(1000);
    const Wysiwyg = odoo.__DEBUG__.services['web_editor.wysiwyg'];
    return new Wysiwyg(parent, options);
}

async function loadFromTextarea(parent, textarea, options) {
    const $textarea = $(textarea);
    const currentOptions = Object.assign({}, options);
    if (!currentOptions.value || !currentOptions.value.trim()) {
        currentOptions.value = '<p><br><p>';
    }
    const wysiwyg = await createWysiwyg(parent, Object.assign({
        template: `<t-dialog><t t-zone="default"/></t-dialog>
            <div class="d-flex flex-grow-1 flex-column" style="height: 200px">
                <div class="o_toolbar">
                    <t t-zone="tools"/>
                </div>
                <div class="d-flex flex-grow-1 overflow-auto note-editing-area">
                    <t t-zone="main"/>
                </div>
                <div class="o_debug_zone">
                    <t t-zone="debug"/>
                </div>
            </div>`
        }, currentOptions));

    const $wysiwygWrapper = $textarea.closest('.o_wysiwyg_wrapper');
    const $form = $textarea.closest('form');
    $wysiwygWrapper.css({
        'display': 'flex',
        'flex-direction': 'column',
        'flex-grow': '1 1 auto',
        'height': 200,
    });

    // hide and append the $textarea in $form so it's value will be send
    // through the form.
    $textarea.hide();
    $form.append($textarea);

    await wysiwyg.attachTo($wysiwygWrapper);
    $form.find('.note-editable').data('wysiwyg', wysiwyg);

    $form.on('click', 'button[type=submit]', async (e) => {
        // float-left class messes up the post layout OPW 769721
        $form.find('.note-editable').find('img.float-left').removeClass('float-left');
        $textarea.val(await wysiwyg.getValue());
    });

    return wysiwyg;
}

return {
    loadFromTextarea: loadFromTextarea,
    createWysiwyg: createWysiwyg,
};
});
