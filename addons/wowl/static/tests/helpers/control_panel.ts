import { ViewType } from "../../src/types";
import { AdmissibleTarget, Finder, findItem, getNode, triggerEvent } from "./dom";
import { click } from "./utility";

/////////////////////////////////////
// Menu (generic)
/////////////////////////////////////

export async function toggleMenuItem(el: AdmissibleTarget, itemFinder: Finder): Promise<void> {
  const item = findItem(el, `.o_menu_item`, itemFinder);
  await click(item);
}

export async function toggleMenuItemOption(
  el: AdmissibleTarget,
  itemFinder: Finder,
  optionFinder: Finder
): Promise<void> {
  const item = findItem(el, `.o_menu_item`, itemFinder);
  const option = findItem(item.parentNode as HTMLElement, ".o_item_option", optionFinder);
  await click(option);
}

export function isItemSelected(el: AdmissibleTarget, itemFinder: Finder): boolean {
  const item = findItem(el, `.o_menu_item`, itemFinder);
  return item.classList.contains("selected");
}

export function isOptionSelected(
  el: AdmissibleTarget,
  itemFinder: Finder,
  optionFinder: Finder
): boolean {
  const item = findItem(el, `.o_menu_item`, itemFinder);
  const option = findItem(item.parentNode as HTMLElement, ".o_item_option", optionFinder);
  return option.classList.contains("selected");
}

export function getMenuItemTexts(el: AdmissibleTarget): string[] {
  return [...getNode(el).querySelectorAll(`.o_dropdown ul .o_menu_item`)].map((e) =>
    (e as HTMLElement).innerText.trim()
  );
}

/////////////////////////////////////
// Filter Menu
/////////////////////////////////////

/**
 * @param {EventTarget} el
 * @returns {Promise}
 */
export async function toggleFilterMenu(el: AdmissibleTarget): Promise<void> {
  await click(findItem(el, `.o_filter_menu button.o_dropdown_toggler`));
}

// /**
//  * @param {EventTarget} el
//  * @returns {Promise}
//  */
// export async function toggleAddCustomFilter(el: AdmissibleTarget) {
//     await click(getNode(el).querySelector(`button.o_add_custom_filter`));
// }

// /**
//  * @param {EventTarget} el
//  * @returns {Promise}
//  */
// export async function applyFilter(el) {
//     await click(getNode(el).querySelector(`div.o_add_filter_menu > button.o_apply_filter`));
// }

// /**
//  * @param {EventTarget} el
//  * @returns {Promise}
//  */
// export async function addCondition(el) {
//     await click(getNode(el).querySelector(`div.o_add_filter_menu > button.o_add_condition`));
// }

/////////////////////////////////////
// Group By Menu
/////////////////////////////////////

export async function toggleGroupByMenu(el: AdmissibleTarget) {
  await click(findItem(el, `.o_group_by_menu button.o_dropdown_toggler`));
}

export async function toggleAddCustomGroup(el: AdmissibleTarget) {
  await click(findItem(el, `button.o_add_custom_group_by`));
}

export async function selectGroup(el: AdmissibleTarget, fieldName: string) {
  const select = findItem(el, `select.o_group_by_selector`) as HTMLSelectElement;
  select.value = fieldName;
  await triggerEvent(select, "change");
}

export async function applyGroup(el: AdmissibleTarget) {
  await click(findItem(el, `div.o_add_group_by_menu > button.o_apply_group_by`));
}

/////////////////////////////////////
// Favorite Menu
/////////////////////////////////////

export async function toggleFavoriteMenu(el: AdmissibleTarget) {
  await click(findItem(el, `.o_favorite_menu button.o_dropdown_toggler`));
}

export async function toggleSaveFavorite(el: AdmissibleTarget) {
  await click(findItem(el, `.o_favorite_menu .o_add_favorite button.o_dropdown_toggler`));
}

export async function editFavoriteName(el: AdmissibleTarget, name: string) {
  const input = findItem(
    el,
    `.o_favorite_menu .o_add_favorite .o_dropdown_menu input[type="text"]`
  ) as HTMLInputElement;
  input.value = name;
  await triggerEvent(input, "input");
}

export async function saveFavorite(el: AdmissibleTarget) {
  await click(
    findItem(el, `.o_favorite_menu .o_add_favorite .o_dropdown_menu button.o_save_favorite`)
  );
}

export async function deleteFavorite(el: AdmissibleTarget, favoriteFinder: Finder) {
  const favorite = findItem(el, `.o_favorite_menu .o_menu_item`, favoriteFinder);
  await click(findItem(favorite, "i.fa-trash-o"));
}

/////////////////////////////////////
// Comparison Menu
/////////////////////////////////////

export async function toggleComparisonMenu(el: AdmissibleTarget) {
  await click(findItem(el, `.o_comparison_menu button.o_dropdown_toggler`));
}

/////////////////////////////////////
// Search Bar
/////////////////////////////////////

export function getFacetTexts(el: AdmissibleTarget) {
  return [...getNode(el).querySelectorAll(`div.o_searchview_facet`)].map((facet) =>
    (facet as HTMLElement).innerText.trim()
  );
}

export async function removeFacet(el: AdmissibleTarget, facetFinder: Finder = 0) {
  const facet = findItem(el, `div.o_searchview_facet`, facetFinder);
  await click(facet.querySelector("i.o_facet_remove") as HTMLElement);
}

// /**
//  * @param {EventTarget} el
//  * @param {string} value
//  * @returns {Promise}
//  */
// export async function editSearch(el, value) {
//     await editInput(getNode(el).querySelector(`.o_searchview_input`), value);
// }

// /**
//  * @param {EventTarget} el
//  * @returns {Promise}
//  */
// export async function validateSearch(el) {
//     await triggerEvent(
//         getNode(el).querySelector(`.o_searchview_input`),
//         'keydown', { key: 'Enter' }
//     );
// }

/////////////////////////////////////
// Action Menu
/////////////////////////////////////

// /**
//  * @param {EventTarget} el
//  * @param {string} [menuFinder="Action"]
//  * @returns {Promise}
//  */
// export async function toggleActionMenu(el, menuFinder = "Action") {
//     const dropdown = findItem(el, `.o_cp_action_menus button`, menuFinder);
//     await click(dropdown);
// }

/////////////////////////////////////
// Pager
/////////////////////////////////////

// /**
//  * @param {EventTarget} el
//  * @returns {Promise}
//  */
// export async function pagerPrevious(el) {
//     await click(getNode(el).querySelector(`.o_pager button.o_pager_previous`));
// }

// /**
//  * @param {EventTarget} el
//  * @returns {Promise}
//  */
// export async function pagerNext(el) {
//     await click(getNode(el).querySelector(`.o_pager button.o_pager_next`));
// }

// /**
//  * @param {EventTarget} el
//  * @returns {string}
//  */
// export function getPagerValue(el) {
//     const pagerValue = getNode(el).querySelector(`.o_pager_counter .o_pager_value`);
//     switch (pagerValue.tagName) {
//         case 'INPUT':
//             return pagerValue.value;
//         case 'SPAN':
//             return pagerValue.innerText.trim();
//     }
// }

// /**
//  * @param {EventTarget} el
//  * @returns {string}
//  */
// export function getPagerSize(el) {
//     return getNode(el).querySelector(`.o_pager_counter span.o_pager_limit`).innerText.trim();
// }

// /**
//  * @param {EventTarget} el
//  * @param {string} value
//  * @returns {Promise}
//  */
// export async function setPagerValue(el, value) {
//     let pagerValue = getNode(el).querySelector(`.o_pager_counter .o_pager_value`);
//     if (pagerValue.tagName === 'SPAN') {
//         await click(pagerValue);
//     }
//     pagerValue = getNode(el).querySelector(`.o_pager_counter input.o_pager_value`);
//     if (!pagerValue) {
//         throw new Error("Pager value is being edited and cannot be changed.");
//     }
//     await editAndTrigger(pagerValue, value, ['change', 'blur']);
// }

/////////////////////////////////////
// View Switcher
/////////////////////////////////////

export async function switchView(el: AdmissibleTarget, viewType: ViewType) {
  await click(findItem(el, `button.o_switch_view.o_${viewType}`));
}
