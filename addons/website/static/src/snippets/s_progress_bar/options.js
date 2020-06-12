odoo.define('website.s_progress_bar_options', function (require) {
'use strict';

const core = require('web.core');
const utils = require('web.utils');
const snippetOptions = require('web_editor.snippets.options');

const _t = core._t;

snippetOptions.registry.progress = snippetOptions.SnippetOptionsWidget.extend({

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Changes the position of the progressbar text.
     *
     * @see this.selectClass for parameters
     */
    display: async function (previewMode, widgetValue, params) {
        await this.wysiwyg.editor.execBatch(async () => {
            // retro-compatibility

            let $text = this.$target.find('.s_progress_bar_text');

            // todo: Test this.
            if (this.$target.hasClass('progress')) {
                this.$target.removeClass('progress');
                await this.editorHelpers.removeClass(this.$target[0], 'progress');
                await this.editorHelpers.wrap(this.$target.find('.progress-bar')[0], $('<div/>', {class: 'progress'})[0].outerHTML);
                await this.editorHelpers.addClass(this.$target.find('.progress-bar span')[0], 's_progress_bar_text');
            }

            await this.editorHelpers.remove($text[0].childNodes[0]);
            if (!$text.length) {
                $text = $('<span/>').addClass('s_progress_bar_text').html(_t('80% Development'));
            }


            if (widgetValue === 'inline') {
                await this.editorHelpers.insertHtml($text[0].outerHTML, this.$target.find('.progress-bar')[0], 'INSIDE');
            } else {
                await this.editorHelpers.insertHtml($text[0].outerHTML, this.$target.find('.progress')[0], 'BEFORE');
            }
        });
    },
    /**
     * Sets the progress bar value.
     *
     * @see this.selectClass for parameters
     */
    progressBarValue: async function (previewMode, widgetValue, params) {
        await this.wysiwyg.editor.execBatch(async () => {
            let value = parseInt(widgetValue);
            value = utils.confine(value, 0, 100);
            const $progressBar = this.$target.find('.progress-bar');
            const $progressBarText = this.$target.find('.s_progress_bar_text');
            // Target precisely the XX% not only XX to not replace wrong element
            // eg 'Since 1978 we have completed 45%' <- don't replace 1978
            const previousProgressChildNodes = $progressBarText[0].childNodes[0];
            $progressBarText.text($progressBarText.text().replace(/[0-9]+%/, value + '%'));
            const replacedText = $progressBarText[0].outerHTML;
            await this.editorHelpers.replace(previousProgressChildNodes, replacedText);
            await this.editorHelpers.setStyle($progressBar[0], 'width', value + "%");
            await this.editorHelpers.setAttribute($progressBar[0], 'aria-valuenow', '' + value);
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _computeWidgetState: function (methodName, params) {
        switch (methodName) {
            case 'display': {
                const isInline = this.$target.find('.s_progress_bar_text')
                                        .parent('.progress-bar').length;
                return isInline ? 'inline' : 'below';
            }
            case 'progressBarValue': {
                return this.$target.find('.progress-bar').attr('aria-valuenow') + '%';
            }
        }
        return this._super(...arguments);
    },
});
});
