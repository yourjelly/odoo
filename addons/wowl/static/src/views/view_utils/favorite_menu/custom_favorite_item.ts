import { Component, hooks } from "@odoo/owl";
import { useService } from "../../../core/hooks";
import { NotificationService } from "../../../notifications/notification_service";
import { OdooEnv } from "../../../types";
import { SearchModel, Favorite } from "../search_model";
import { Dropdown } from "../../../components/dropdown/dropdown";
import { OwlEvent } from "@odoo/owl/dist/types/core/owl_event";
const { useRef } = hooks;

interface State {
  description: string;
  isDefault: boolean;
  isShared: boolean;
}

let favoriteId = 0;

/**
 * Favorite generator menu
 *
 * This component is used to add a new favorite linked which will take every
 * information out of the current context and save it to a new `ir.filter`.
 *
 * There are 3 additional inputs to modify the filter:
 * - a text input (mandatory): the name of the favorite (must be unique)
 * - 'use by default' checkbox: if checked, the favorite will be the default
 *                              filter of the current model (and will bypass
 *                              any existing default filter). Cannot be checked
 *                              along with 'share with all users' checkbox.
 * - 'share with all users' checkbox: if checked, the favorite will be available
 *                                    with all users instead of the current
 *                                    one.Cannot be checked along with 'use
 *                                    by default' checkbox.
 * Finally, there is a 'Save' button used to apply the current configuration
 * and save the context to a new filter.
 * @extends DropdownMenuItem
 */
export class CustomFavoriteItem extends Component<{ searchModel: SearchModel }, OdooEnv> {
  static props = { searchModel: SearchModel };
  static template = "wowl.CustomFavoriteItem";
  static components = { Dropdown };
  static groupNumber = 3; // have 'Save Current Search' in its own group
  static shouldBeDisplayed() {
    return true;
  }

  _notificationService: NotificationService = useService("notifications");

  descriptionRef = useRef("description");
  useByDefaultId: string;
  shareAllUsersId: string;

  interactive: boolean = true;
  state: State = {
    description: /** this.env.action.name ||*/ "",
    isDefault: false,
    isShared: false,
  };

  constructor() {
    super(...arguments);

    const favId = favoriteId++;
    this.useByDefaultId = `o_favorite_use_by_default_${favId}`;
    this.shareAllUsersId = `o_favorite_share_all_users_${favId}`;

    // useAutofocus();
  }

  //---------------------------------------------------------------------
  // Private
  //---------------------------------------------------------------------

  /**
   * @private
   */
  private saveFavorite() {
    if (!this.state.description.length) {
      this._notificationService.create(
        this.env._t("A name for your favorite filter is required."),
        { type: "danger" }
      );
      return this.descriptionRef.el!.focus();
    }
    const favorites = this.props.searchModel.getSearchItems(
      (f) => f.type === "favorite"
    ) as Favorite[];
    if (favorites.some((f) => f.description === this.state.description)) {
      this._notificationService.create(this.env._t("Filter with same name already exists."), {
        type: "danger",
      });
      return this.descriptionRef.el!.focus();
    }
    this.props.searchModel.createNewFavorite({
      description: this.state.description,
      isDefault: this.state.isDefault,
      isShared: this.state.isShared,
    });
    // Reset state
    Object.assign(this.state, {
      description: /** this.env.action.name ||*/ "",
      isDefault: false,
      isShared: false,
    });
  }

  //---------------------------------------------------------------------
  // Handlers
  //---------------------------------------------------------------------

  /**
   * @private
   * @param {Event} ev change Event
   */
  _onCheckboxChange(ev: OwlEvent<{}>) {
    const { checked, id } = ev.target as HTMLInputElement;
    if (this.useByDefaultId === id) {
      this.state.isDefault = checked;
      if (checked) {
        this.state.isShared = false;
      }
    } else {
      this.state.isShared = checked;
      if (checked) {
        this.state.isDefault = false;
      }
    }
  }

  _onInputKeydown(ev: KeyboardEvent) {
    switch (ev.key) {
      case "Enter":
        ev.preventDefault();
        this.saveFavorite();
        break;
      case "Escape":
        // Gives the focus back to the component.
        ev.preventDefault();
        (ev.target as HTMLInputElement).blur();
        break;
    }
  }
}
