/* @odoo-module */

import { useOnBottomScrolled } from "@mail/utils/hooks";
import { Component, onWillStart, useState } from "@odoo/owl";
import { useService, useAutofocus } from "@web/core/utils/hooks";
import { removeFromArrayWithPredicate } from "@mail/utils/arrays";
import { useDebounced } from "@web/core/utils/timing";
import { useStore } from "@mail/core/messaging_hook";

/**
 * @typedef {Object} Props
 * @property {import("@mail/core/thread_model").Thread} thread
 * @property {Function} [close]
 * @extends {Component<Props, Env>}
 */
export class GifPicker extends Component {
    static template = "mail.GifPicker";
    static props = ["thread", "close?"];

    async setup() {
        this.rpc = useService("rpc");
        /** @type {import('@mail/core/thread_service').ThreadService} */
        this.threadService = useService("mail.thread");
        this.store = useStore();
        this.userService = useService("user");
        useAutofocus();
        useOnBottomScrolled("scroller", () => {
            if (!this.state.showCategories && !this.state.showFavorite) {
                this.searchDebounced(true);
            }
        });
        this.state = useState({
            favorites: [],
            searchTerm: "",
            gifs: [],
            next: "",
            showCategories: true,
            showFavorite: false,
            categories: [],
            loadingGif: false,
            loadingError: false,
        });
        this.searchDebounced = useDebounced(this.search, 200);
        onWillStart(this.loadCategories);
        if (!this.store.guest) {
            onWillStart(this.loadFavorite);
        }
    }

    get evenGif() {
        return this.state.gifs.filter((gif, index) => index % 2 === 0);
    }

    get oddGif() {
        return this.state.gifs.filter((gif, index) => index % 2 !== 0);
    }

    async loadCategories() {
        try {
            const { tags } = await this.rpc("/discuss/gif/categories", {
                locale: this.userService.lang,
                country: this.userService.lang.slice(3, 5),
            });
            if (tags) {
                this.state.categories = tags;
            }
        } catch {
            this.state.loadingError = true;
        }
    }

    openCategories() {
        this.state.showCategories = true;
        this.state.showFavorite = false;
        this.state.searchTerm = "";
    }

    closeCategories() {
        this.state.showCategories = false;
    }

    async search(concat = false) {
        this.state.loadingGif = true;
        try {
            const params = {
                search_term: this.state.searchTerm,
                locale: this.userService.lang,
                country: this.userService.lang.slice(3, 5),
            };
            if (this.state.next) {
                params.pos = this.state.next;
            }
            const { results, next } = await this.rpc("/discuss/gif/search", params);
            if (results) {
                this.state.next = next;
                if (concat) {
                    this.state.gifs = this.state.gifs.concat(results);
                } else {
                    this.state.gifs = results;
                }
            }
        } catch {
            this.state.loadingError = true;
        }
        this.state.loadingGif = false;
    }

    async onInput(ev) {
        this.searchDebounced();
        if (this.state.searchTerm) {
            this.closeCategories();
        } else {
            this.openCategories();
        }
    }

    onClickGif(gif) {
        this.threadService.post(this.props.thread, gif.url);
        this.props.close();
    }

    async onClickCategory(category) {
        this.state.searchTerm = category.searchterm;
        await this.search();
        this.closeCategories();
    }

    async onClickFavorite(gif) {
        if (!this.isFavorite(gif)) {
            this.state.favorites.push(gif);
            await this.rpc("/discuss/gif/set_favorite", { tenor_gif_id: gif.id });
        } else {
            removeFromArrayWithPredicate(this.state.favorites, ({ id }) => id === gif.id);
            await this.rpc("/discuss/gif/remove_favorite", { tenor_gif_id: gif.id });
        }
    }

    async loadFavorite() {
        const { results } = await this.rpc("/discuss/gif/favorites");
        this.state.favorites = results;
    }

    isFavorite(gif) {
        return this.state.favorites.map((favorite) => favorite.id).includes(gif.id);
    }

    async onClickFavoriteCategory() {
        this.state.gifs = this.state.favorites;
        this.closeCategories();
        this.state.showFavorite = true;
    }
}
