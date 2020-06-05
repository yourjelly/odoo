odoo.define('web_editor.loader', function (require) {
'use strict';

var ajax = require('web.ajax');

function waitTimeout(ms) {
    return new Promise((resolve)=>{
        setTimeout(() => {
            resolve()
        }, ms);
    })
}

const loadedLib = new Set();
/**
 * Load the assets and create a wysiwyg.
 *
 * @param {Widget} parent The wysiwyg parent
 * @param {object} options The wysiwyg options
 */
async function createWysiwyg(parent, options, additionnalAssets = []) {
    const assetLib = options.legacy === false ?
        'web_editor.compiled_assets_wysiwyg_jabberwock' :
        'web_editor.compiled_assets_wysiwyg';
    if (!loadedLib.has(assetLib)) {
        // todo: find a better way to add additionnal assets
        await ajax.loadLibs({ assetLibs: [ assetLib, ...additionnalAssets ] });
        loadedLib.add(assetLib);
    }
    await ajax.loadLibs({ assetLibs: [ assetLib ] });
    // todo: find why the service is not yet ready than remove this function
    await waitTimeout(1000);
    const Wysiwyg = odoo.__DEBUG__.services['web_editor.wysiwyg'];
    return new Wysiwyg(parent, options);
}

async function loadFromTextarea(parent, $textarea, options) {
    const wysiwyg = await createWysiwyg(parent, options);

    const $wysiwygWrapper = $textarea.closest('.o_wysiwyg_wrapper');
    const $form = $textarea.closest('form');

    // hide and append the $textarea in $form so it's value will be send
    // through the form.
    $textarea.hide();
    $form.append($textarea);

    wysiwyg.attachTo($wysiwygWrapper);

    $form.on('click', 'button[type=submit]', (e) => {
        // float-left class messes up the post layout OPW 769721
        $form.find('.note-editable').find('img.float-left').removeClass('float-left');
        $textarea.val(wysiwyg.getValue());
    });

    return wysiwyg;
}

return {
    loadFromTextarea: loadFromTextarea,
    createWysiwyg: createWysiwyg,
};
});
