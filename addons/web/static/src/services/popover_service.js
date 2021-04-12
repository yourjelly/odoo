/** @odoo-module **/

import { useBus } from "../utils/hooks";
import { mainComponentRegistry } from "../webclient/main_component_registry";
import { serviceRegistry } from "../webclient/service_registry";
import { Popover } from "../components/popover/popover";

const { Component } = owl;
const { EventBus } = owl.core;
const { useState } = owl.hooks;
const { xml } = owl.tags;

const bus = new EventBus();

export class KeyAlreadyExistsError extends Error {
  constructor(key) {
    super(`PopoverManager already contains key "${key}"`);
  }
}

export class KeyNotFoundError extends Error {
  constructor(key) {
    super(`PopoverManager does not contain key "${key}"`);
  }
}

export class PopoverManager extends Component {
  setup() {
    this.state = useState({
      rev: 0,
    });
    this.popovers = {};
    this.nextId = 0;

    useBus(bus, "ADD", this.addPopover);
    useBus(bus, "REMOVE", this.removePopover);
  }

  /**
   * @param {Object}    params
   * @param {string}    [params.key]
   * @param {string}    [params.content]
   * @param {any}       [params.Component]
   * @param {Object}    [params.props]
   * @param {Function}  [params.onClose]
   * @param {boolean}   [params.keepOnClose=false]
    ////////////////////////////////////////////////////////////////////////////
   * @param {Object}   [params.handlers]
    ////////////////////////////////////////////////////////////////////////////
   */
  addPopover(params) {
    const key = params.key || this.nextId;
    if (this.popovers[key]) {
      throw new KeyAlreadyExistsError(key);
    }

    this.popovers[key] = Object.assign({ key }, params);

    ////////////////////////////////////////////////////////////////////////////
    for (const [evType, handler] of Object.entries(params.handlers || {})) {
      this.el.addEventListener(evType, handler);
    }
    ////////////////////////////////////////////////////////////////////////////

    this.nextId += 1;
    this.state.rev += 1;
  }
  /**
   * @param {string | number} key
   */
  removePopover(key) {
    if (!this.popovers[key]) {
      throw new KeyNotFoundError(key);
    }

    ////////////////////////////////////////////////////////////////////////////
    const handlers = this.popovers[key].handlers || {};
    for (const [evType, handler] of Object.entries(handlers)) {
      this.el.removeEventListener(evType, handler);
    }
    ////////////////////////////////////////////////////////////////////////////

    delete this.popovers[key];

    this.state.rev += 1;
  }

  /**
   * @param {string | number} key
   */
  onPopoverClosed(key) {
    if (!this.popovers[key]) {
      // It can happen that the popover was removed just before this call.
      return;
    }
 
    if (this.popovers[key].onClose) {
      this.popovers[key].onClose();
    }
    if (!this.popovers[key].keepOnClose) {
      this.removePopover(key);
    }
  }
}
PopoverManager.components = { Popover }; // remove this as soon as Popover is globally registered
PopoverManager.template = xml`
  <div class="o_popover_manager">
    <div class="o_popover_container" />
    <t t-foreach="Object.values(popovers)" t-as="popover" t-key="popover.key">
      <t t-if="popover.Component">
        <t t-component="popover.Component"
          t-props="popover.props"
          t-on-popover-closed="onPopoverClosed(popover.key)"
        />
      </t>
      <t t-else="">
        <Popover
          t-props="popover.props"
          t-on-popover-closed="onPopoverClosed(popover.key)"
        >
          <t t-set-slot="content"><t t-esc="popover.content"/></t>
        </Popover>
      </t>
    </t>
  </div>
`;

mainComponentRegistry.add("PopoverManager", PopoverManager);

export const popoverService = {
  start(env) {
    return {
      /**
       * Signals the manager to add a popover.
       *
       * @param {Object}    params
       * @param {string}    [params.key]
       * @param {string}    [params.content]
       * @param {any}       [params.Component]
       * @param {Object}    [params.props]
       * @param {Function}  [params.onClose]
       * @param {boolean}   [params.keepOnClose=false]
       */
      add(params) {
        bus.trigger("ADD", params);
      },
      /**
       * Signals the manager to remove the popover with key = `key`.
       *
       * @param {string} key
       */
      remove(key) {
        bus.trigger("REMOVE", key);
      },
    };
  },
};

serviceRegistry.add("popover", popoverService);
