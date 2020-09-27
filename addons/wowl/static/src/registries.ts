import { Component } from "@odoo/owl";
import { Registry } from "./registry";
import { routerService } from "./router";
import { rpcService } from "./rpc";
import { Service } from "./services";
import { Type } from "./types";

// Services
const serviceRegistry: Registry<Service> = new Registry();

serviceRegistry.add(rpcService.name, rpcService).add(routerService.name, routerService);

// Main Components
const mainComponentRegistry: Registry<Type<Component>> = new Registry();

export const registries = {
  Components: mainComponentRegistry,
  services: serviceRegistry,
};

export type Registries = typeof registries;
