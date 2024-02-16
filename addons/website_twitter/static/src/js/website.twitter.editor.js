import { _t } from "@web/core/l10n/translation";
import dom from "@web/legacy/js/core/dom";
import { rpc } from "@web/core/network/rpc";
import sOptions from "@web_editor/js/editor/snippets.options";

sOptions.registry.twitter = sOptions.Class.extend({
    /**
     * @override
     */
    start: function () {
        var $configuration = dom.renderButton({
            attrs: {
                class: 'btn-primary d-none',
                contenteditable: 'false',
            },
            text: _t("Reload"),
        });
        const div = document.createElement('div');
        document.body.appendChild(div);
        $configuration.appendTo(div).on('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            rpc('/website_twitter/reload');
        });
        this.$target.on('mouseover.website_twitter', function () {
            var $selected = $(this);
            var position = $selected.offset();
            $configuration.removeClass('d-none').offset({
                top: $selected.outerHeight() / 2
                        + position.top
                        - $configuration.outerHeight() / 2,
                left: $selected.outerWidth() / 2
                        + position.left
                        - $configuration.outerWidth() / 2,
            });
        }).on('mouseleave.website_twitter', function (e) {
            if (isNaN(e.clientX) || isNaN(e.clientY)) {
                return;
            }
            var current = document.elementFromPoint(e.clientX, e.clientY);
            if (current === $configuration[0]) {
                return;
            }
            $configuration.addClass('d-none');
        });
        this.$target.on('click.website_twitter', '.lnk_configure', function (e) {
            window.location = e.currentTarget.href;
        });
        this.trigger_up('widgets_stop_request', {
            $target: this.$target,
        });
        return this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    cleanForSave: function () {
        this.$target.find('.twitter_timeline').empty();
    },
    /**
     * @override
     */
    destroy: function () {
        this._super.apply(this, arguments);
        this.$target.off('.website_twitter');
    },
});
