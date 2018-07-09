odoo.define('mail.composer.gif', function (require) {
"use strict";

var BasicComposer = require('mail.composer.Basic');
var core = require('web.core');

var QWeb = core.qweb;

BasicComposer.include({
    events: _.extend({}, BasicComposer.prototype.events, {
        'click .o_composer_button_gif': '_onGIFButtonClick',
        'input .o_search_gif_input': '_onSearchGIF',
        'click .gif_image': '_onGIFClick',
    }),
    /**
     * @override
     */
    init: function () {
        this.gifCatch = {
            search: {},
            trending: [],
        };
        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * fetch next page and render gif
     *
     * @private
     */
    _fetchGIF: function (reset) {
        var self = this;
        this.gifSearch.next().then(function (gifs) {
            self._renderGIF(gifs, reset);
        }).fail(function (err) {
            self._renderGIF({ error: true }, reset);
        });
    },
    /**
     * @private
     */
    _fetchGiphyKey: function () {
        var self = this;
        if(self.giphyKey) {
            return $.Deferred().resolve();
        }
        return this._rpc({
            model: 'ir.config_parameter',
            method: 'get_param',
            args: ['giphy.secret_key'],
        }).then(function (res) {
            self.giphyKey = res;
        });
    },
    /**
     * get GIF from GIPHY API
     *
     * @param {method} search or trending
     * @private
     */
    _getGIF: function (method, params) {
        var self = this;
        params = params || {};
        _.extend(params, {
            offset: -50,
            limit: 50,
        });
        if (params.q && !self.gifCatch[method][params.q]) {
            self.gifCatch[method][params.q] = [];
        }
        return {
            next: function () {
                return self._fetchGiphyKey().then(function () {
                    if (!self.giphyKey) {
                        return $.Deferred().reject();
                    }
                    params.api_key = self.giphyKey;
                    var catchData = params.q ? self.gifCatch[method][params.q] : self.gifCatch[method];
                    params.offset += params.limit;
                    if (catchData.length >= (params.offset + params.limit)) {
                        return $.when({ data: catchData.slice(params.offset, params.offset + params.limit) });
                    }
                    return $.get('https://api.giphy.com/v1/gifs/'+method, params).then(function (res, err) {
                        catchData.push.apply(catchData, res.data);
                        return res;
                    });
                });
            }
        }
    },
    /**
     * @private
     */
    _renderGIF: function (gifs, reset) {
        var $gifItems = $(QWeb.render('mail.Composer.gif.items', { gifs: gifs }));
        if(reset) {
            this._$gifContainer.find('.gifContiner').html('');
            this._$gifContainer.find('.gifContiner').scroll(_.debounce(this._onScroll.bind(this), 200));
        }
        $gifItems.appendTo(this._$gifContainer.find('.gifContiner'));
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onGIFClick: function (ev) {
        var url = $(ev.target).data('url');
        this.trigger('post_message', { content: '<img src='+url+' />' });
    },
    /**
     * @private
     */
    _onGIFButtonClick: function() {
        if (!this._$gifContainer) {
            this._$gifContainer = $(QWeb.render('mail.Composer.gif'));
        } 
        if (this._$gifContainer.parent().length) {
            this._$gifContainer.remove();
        } else {
            this._$gifContainer.appendTo(this.$('.o_composer_container'));
            this._$gifContainer.find('.o_search_gif_input').val('');
            this.gifSearch = this._getGIF('trending');
            this._fetchGIF(true);
        }
    },
    /**
     * @private
     */
    _onScroll: function () {
        var $elem=$('.gifContiner');
        var newScrollLeft = $elem.scrollLeft(),
            width=$elem.width(),
            scrollWidth=$elem.get(0).scrollWidth;
        if (scrollWidth - newScrollLeft - width < 300) {
            this._fetchGIF();
        }
    },
    /**
     * @private
     */
    _onSearchGIF: _.debounce(function (ev) {
        var val = ev.target.value;
        this.gifSearch = val ? this._getGIF('search', { q: val }) : this._getGIF('trending');
        this._fetchGIF(true);
    }, 1000),

});
});
