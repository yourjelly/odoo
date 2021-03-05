/** @odoo-module **/

import { favoriteMenuRegistry } from "./favorite_menu_registry";
import { SearchComponent } from "../search_component";
import { useAutofocus } from "../../../utils/hooks";
import { useService } from "../../../services/service_hook";
const { useRef, useState } = owl.hooks;

export class CustomFavoriteItem extends SearchComponent {
  setup() {
    super.setup();

    this._notificationService = useService("notification");
    this.descriptionRef = useRef("description");

    useAutofocus();

    this.state = useState({
      description: this.env.searchModel.displayName,
      isDefault: false,
      isShared: false,
    });
  }

  saveFavorite() {
    if (!this.state.description.length) {
      this._notificationService.create(
        this.env._t("A name for your favorite filter is required."),
        { type: "danger" }
      );
      return this.descriptionRef.el.focus();
    }
    const favorites = this.env.searchModel.getSearchItems(
      (s) => s.type === "favorite" && s.description === this.state.description
    );
    if (favorites.length) {
      this._notificationService.create(this.env._t("A filter with same name already exists."), {
        type: "danger",
      });
      return this.descriptionRef.el.focus();
    }
    const { description, isDefault, isShared } = this.state;
    this.env.searchModel.createNewFavorite({ description, isDefault, isShared });

    Object.assign(this.state, {
      description: this.env.searchModel.displayName,
      isDefault: false,
      isShared: false,
    });
  }

  /**
   * @param {Event} ev
   */
  onDefaultCheckboxChange(ev) {
    const { checked } = ev.target;
    this.state.isDefault = checked;
    if (checked) {
      this.state.isShared = false;
    }
  }

  /**
   * @param {Event} ev
   */
  onShareCheckboxChange(ev) {
    const { checked } = ev.target;
    this.state.isShared = checked;
    if (checked) {
      this.state.isDefault = false;
    }
  }

  /**
   * @param {KeyboardEvent} ev
   */
  onInputKeydown(ev) {
    switch (ev.key) {
      case "Enter":
        ev.preventDefault();
        this.saveFavorite();
        break;
      case "Escape":
        // Gives the focus back to the component.
        ev.preventDefault();
        ev.target.blur();
        break;
    }
  }
}

CustomFavoriteItem.template = "wowl.CustomFavoriteItem";
CustomFavoriteItem.groupNumber = 3;
CustomFavoriteItem.shouldBeDisplayed = () => true;

favoriteMenuRegistry.add("custom-favorite-item", CustomFavoriteItem);
