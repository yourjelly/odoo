(function () {
'use strict';

var ClipboardPlugin = class extends we3.AbstractPlugin {
    static get autoInstall () {
        return [];
    }

    constructor () {
        super(...arguments);
        this.dependencies = ['Arch'];
        this.editableDomEvents = {
            'paste': '_onPaste',
        };
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Prepare clipboard data for safe pasting into the editor.
     *
     * @see clipboardWhitelist
     * @see clipboardBlacklist
     *
     * @param {DOMString} clipboardData
     * @returns {DOM-fragment}
     */
    prepareClipboardData (clipboardData) {
        var container = document.createElement('we3-container');
        container.innerHTML = clipboardData;
        var fragment = document.createDocumentFragment();
        [].slice.call(container.childNodes).forEach(function (node) {
            fragment.appendChild(node);
        });
        this._removeIllegalClipboardElements(fragment);
        this._removeIllegalClipboardAttributes(fragment);
        fragment.querySelectorAll('a').forEach(function (a) {
            a.className = '';
        })
        fragment.querySelectorAll('img').forEach(function (img) {
            img.style.maxWidth = '100%';
        })
        return fragment;
    }
    /**
     * Prepare clipboard data for safe pasting into the editor.
     * Escape tags
     *
     * @param {String} clipboardData
     * @returns {DOM-fragment}
     */
    prepareTextClipboardData (clipboardData) {
        var isXML = !!clipboardData.match(/<[a-z]+[a-z0-9-]*( [^>]*)*>[\s\S\n\r]*<\/[a-z]+[a-z0-9-]*>/i);
        var isJS = !isXML && !!clipboardData.match(/\(\);|this\.|self\.|function\s?\(|super\.|[a-z0-9]\.[a-z].*;/i);

        var fragment = document.createDocumentFragment();
        var pre = document.createElement('pre');
        pre.innerHTML = clipboardData.trim()
            .replace(/</g, '&lt;').replace(/>/g, '&gt;')
            // get that text as an array of text nodes separated by <br> where needed
            .replace(/\n/g, '<br>');

        if (isJS || isXML) {
            fragment.appendChild(pre);
        } else {
            [].slice.call(pre.childNodes).forEach(function (node) {
                fragment.appendChild(node);
            });
        }
        return fragment;
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Remove the non-whitelisted or blacklisted
     * top level elements from clipboard data.
     *
     * @see clipboardWhitelist
     * @see clipboardBlacklist
     *
     * @private
     * @param {DOM} fragment
     * @returns {Object} didRemoveNodes: Boolean
     */
    _cleanClipboardRoot (fragment) {
        var self = this;
        var didRemoveNodes = false;
        var whiteList = [].slice.call(fragment.querySelectorAll(this._clipboardWhitelist().join(',')));
        var blackList = [].slice.call(fragment.querySelectorAll(this._clipboardBlacklist().join(',')));
        [].slice.call(fragment.childNodes).forEach(function (node) {
            var isWhitelisted = !node.tagName || whiteList.indexOf(node) !== -1;
            var isBlacklisted = blackList.indexOf(node) !== -1;
            if (!isWhitelisted || isBlacklisted) {
                self._removeNodePreserveContents(node);
                didRemoveNodes = true;
            }
        });
        return didRemoveNodes;
    }
    /**
     * Return a list of DOM selectors for prohibited nodes on paste.
     *
     * @private
     * @returns {String[]}
     */
    _clipboardBlacklist () {
        return ['.Apple-interchange-newline', 'meta', 'style', 'script'];
    }
    /**
     * Return a list of DOM selectors for exclusively authorized nodes on paste.
     *
     * @private
     * @returns {String[]}
     */
    _clipboardWhitelist () {
        var listSels = ['ul', 'ol', 'li'];
        var styleSels = ['i', 'b', 'u', 'em', 'strong'];
        var tableSels = ['table', 'th', 'tbody', 'tr', 'td'];
        var miscSels = ['img', 'br', 'a', '.fa'];
        return this.options.styleTags.concat(listSels, styleSels, tableSels, miscSels);
    }
    /**
     * Return a list of attribute names that are exclusively authorized on paste.
     * 
     * @private
     * @returns {String[]}
     */
    _clipboardWhitelistAttr () {
        return ['class', 'href', 'src'];
    }
    /**
     * Get all non-whitelisted or blacklisted elements from clipboard data.
     *
     * @private
     * @param {DOM} fragment
     * @returns {DOM}
     */
    _filterIllegalClipboardElements (fragment) {
        var self = this;
        var badNodes = [];
        var whitelisted = [].slice.call(fragment.querySelectorAll(this._clipboardWhitelist().join(',')));
        var blacklisted = [].slice.call(fragment.querySelectorAll(this._clipboardBlacklist().join(',')));
        blacklisted.forEach(function (node) {
            if (whitelisted.indexOf(node) === -1) {
                badNodes.push(node);
            }
        });
        return badNodes;
    }
    /**
     * Remove non-whitelisted attributes from clipboard.
     *
     * @private
     * @param {DOM} fragment
     */
    _removeIllegalClipboardAttributes (fragment) {
        var self = this;
        fragment.querySelectorAll('*').forEach(function (node) {
            var name;
            var atts = node.attributes;
            for (var i = 0, n = atts.length; i < n; i++){
                name = atts[i].name;
                if (self._clipboardWhitelistAttr().indexOf(name) === -1) {
                    node.removeAttribute(name);
                }
            }
        });
    }
    /**
     * Remove non-whitelisted and blacklisted elements from clipboard data.
     *
     * @private
     * @param {DOM} clipboardData
     */
    _removeIllegalClipboardElements (fragment) {
        var root = true;
        var badNodes = this._filterIllegalClipboardElements(fragment);

        do {
            this._cleanClipboardRoot(fragment);
            badNodes = this._filterIllegalClipboardElements(fragment);
        } while (badNodes.length);
    }
    /**
     * Remove node from the DOM while preserving their contents if any.
     *
     * @private
     * @param {DOM} node
     */
    _removeNodePreserveContents (node) {
        [].slice.call(node.childNodes).forEach(function (child) {
            node.parentNode.insertBefore(child, node);
        });
        node.parentNode.removeChild(node);
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Handle paste events to permit cleaning/sorting of the data before pasting.
     *
     * @private
     * @param {DOMEvent} e
     */
    _onPaste (e) {
        e.preventDefault();
        var fragment;
        // Clean up
        var clipboardData = e.clipboardData.getData('text/html');
        if (clipboardData) {
            fragment = this.prepareClipboardData(clipboardData);
        } else {
            clipboardData = e.clipboardData.getData('text/plain');
            fragment = this.prepareTextClipboardData(clipboardData);
        }
        // Insert the nodes
        this.dependencies.Arch.insert(fragment);
    }
};

we3.addPlugin('ClipboardPlugin', ClipboardPlugin);

})();
