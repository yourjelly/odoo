import { Component, hooks } from "@odoo/owl";
import { Dropdown } from "../../../components/dropdown/dropdown";
import { Registry } from "../../../core/registry";
import { DropdownItem } from "../../../components/dropdown/dropdown_item";
import { OwlEvent } from "@odoo/owl/dist/types/core/owl_event";
import { FACET_ICONS } from "../../view_utils/search_utils";
import { Dialog } from "../../../components/dialog/dialog";
import { SearchModel } from "../search_model";
import { OdooEnv } from "../../../types";
const { useState } = hooks;

interface State {
  toDelete?: {
    itemId: number;
    userId: number | false;
  };
}

export class FavoriteMenu extends Component<{ searchModel: SearchModel }, OdooEnv> {
  static registry = new Registry();
  static components = { Dialog, Dropdown, DropdownItem };
  static template = "wowl.FavoriteMenu";

  icon: string = FACET_ICONS.favorite;
  title: string = this.env._t("Favorites");
  state: State = useState({});

  get items() {
    const favorites = this.props.searchModel.getSearchItems(
      (searchItem) => searchItem.type === "favorite"
    );
    const registryMenus = [];
    for (const Component of odoo.favoriteMenuRegistry.getAll()) {
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

  onDeletionConfirmed(itemId: number) {
    this.emptyState();
    this.props.searchModel.deleteFavorite(itemId);
  }

  onDropdownItemSelected(ev: OwlEvent<{ payload: { itemId: number } }>) {
    const { itemId } = ev.detail.payload;
    this.props.searchModel.toggleSearchItem(itemId);
  }

  openDialog(itemId: number) {
    const { id, userId } = this.items.find((favorite) => favorite.id === itemId);
    this.state.toDelete = { itemId: id, userId };
  }
}
