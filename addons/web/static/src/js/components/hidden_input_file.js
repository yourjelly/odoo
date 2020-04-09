odoo.define('web.HiddenInputFile', function (require) {
    "use strict";

    class HiddenInputFile extends owl.Component {
        constructor() {
            super(...arguments);
            this.targetID = `${this.constructor.name}_${this.constructor._nextID++}`;
            this.fileInputRef = owl.hooks.useRef('fileInputRef');
            this.formRef =owl.hooks.useRef('formRef');
            this.csrfToken = odoo.csrf_token;
        }
        _onFileLoaded(ev) {
            let result;
            try {
                result = JSON.parse(ev.target.contentDocument.body.innerText);
                result = result[0];
            } catch (e) {
                result = {error: e};
            }
            this.trigger('file-ready', result);
        }
        _onChangedFile() {
            this.formRef.el.submit();
        }
        chooseFile() {
            // no other solution
            this.fileInputRef.el.click();
        }
    }
    HiddenInputFile.template = 'web.OwlHiddenInputFile';
    HiddenInputFile._nextID = 0;

    return HiddenInputFile;
});
