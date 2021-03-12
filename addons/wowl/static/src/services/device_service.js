/** @odoo-module **/

import { debounce } from "../utils/misc";
import { serviceRegistry } from "../webclient/service_registry";

export const SIZES = { XS: 0, VSM: 1, SM: 2, MD: 3, LG: 4, XL: 5, XXL: 6 };

export const deviceService = {
  name: "device",
  deploy() {
    const MEDIAS = [
      window.matchMedia("(max-width: 474px)"),
      window.matchMedia("(min-width: 475px) and (max-width: 575px)"),
      window.matchMedia("(min-width: 576px) and (max-width: 767px)"),
      window.matchMedia("(min-width: 768px) and (max-width: 991px)"),
      window.matchMedia("(min-width: 992px) and (max-width: 1199px)"),
      window.matchMedia("(min-width: 1200px) and (max-width: 1533px)"),
      window.matchMedia("(min-width: 1534px)"),
    ];
    function getSize() {
      return MEDIAS.findIndex((media) => media.matches);
    }
    const device = {
      size: getSize(),
      SIZES,
    };
    Object.defineProperty(device, "isSmall", {
      get() {
        return device.size <= SIZES.SM;
      },
    });
    // listen to media query status changes
    function updateSize() {
      device.size = getSize();
    }
    MEDIAS.forEach((media) => media.addEventListener("change", debounce(updateSize, 100)));
    return device;
  },
};

serviceRegistry.add("device", deviceService);
