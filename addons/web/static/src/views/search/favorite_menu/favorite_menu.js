/** @odoo-module **/

import { SearchComponent } from "../search_component";
import { favoriteMenuRegistry } from "./favorite_menu_registry";
import { FACET_ICONS } from "../search_utils";

const { hooks, QWeb } = owl;
const { useState } = hooks;

export class FavoriteMenu extends SearchComponent {
  setup() {
    super.setup();
    this.icon = FACET_ICONS.favorite;
    this.state = useState({});
  }

  get items() {
    const favorites = this.env.searchModel.getSearchItems(
      (searchItem) => searchItem.type === "favorite"
    );
    const registryMenus = [];
    for (const Component of favoriteMenuRegistry.getAll()) {
      if (Component.shouldBeDisplayed(this.env)) {
        registryMenus.push({
          key: Component.name,
          groupNumber: Component.groupNumber,
          Component,
        });
      }
    }
    return [...favorites, ...registryMenus];
  }

  emptyState() {
    delete this.state.toDelete;
  }

  onDeletionConfirmed(itemId) {
    this.emptyState();
    this.env.searchModel.deleteFavorite(itemId);
  }

  onDropdownItemSelected(ev) {
    const { itemId } = ev.detail.payload;
    this.env.searchModel.toggleSearchItem(itemId);
  }

  openDialog(itemId) {
    const { id, userId } = this.items.find((item) => item.id === itemId);
    this.state.toDelete = { itemId: id, userId };
  }
}

FavoriteMenu.template = "wowl.FavoriteMenu";

QWeb.registerComponent("FavoriteMenu", FavoriteMenu);
