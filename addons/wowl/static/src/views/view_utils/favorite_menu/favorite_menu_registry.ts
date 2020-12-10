import { Component } from "@odoo/owl";
import { Registry } from "../../../core/registry";
import { OdooEnv, Type } from "../../../types";
import { CustomFavoriteItem } from "./custom_favorite_item";

export type FavoriteMenuComponent = Type<Component<{}, OdooEnv>> & {
  groupNumber: number;
  shouldBeDisplayed(env: OdooEnv): boolean;
};

export const favoriteMenuRegistry: Registry<FavoriteMenuComponent> = new Registry();

favoriteMenuRegistry.add("favorite-generator-menu", CustomFavoriteItem);
