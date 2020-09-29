import { Component } from "@odoo/owl";
import { OdooEnv } from "./env";
import { Registry } from "./core/registry";

// add here each service type to have better typing for useService
import type { rpcService } from "./services/rpc";
import type { menusService } from "./services/menus";
import type { notificationService } from "./services/notifications";
import type { userService } from "./services/user";
import { routerService } from "./services/router";

type Unwrap<T> = T extends Promise<infer U> ? U : T;
type ServiceType<T extends (...args: any[]) => any> = Unwrap<ReturnType<T>>;

export interface Services {
  rpc: ServiceType<typeof rpcService["deploy"]>;
  menus: ServiceType<typeof menusService["deploy"]>;
  notifications: ServiceType<typeof notificationService["deploy"]>;
  user: ServiceType<typeof userService["deploy"]>;
  router: ServiceType<typeof routerService["deploy"]>;

  [key: string]: any;
}

export interface Service<T = any> {
  name: string;
  dependencies?: string[];
  deploy: ((env: OdooEnv) => Promise<T>) | ((env: OdooEnv) => T);
}

export function useService<T extends keyof Services>(serviceName: T): Services[T] {
  const component = Component.current as Component<any, OdooEnv>;
  const service = component.env.services[serviceName];
  if (!service) {
    throw new Error(`Service ${serviceName} is not available`);
  }
  return typeof service === "function" ? service.bind(component) : service;
}

export const serviceRegistry = new Registry<Service<any>>();

export async function deployServices(
  env: OdooEnv,
  registry: Registry<Service<any>>
): Promise<void> {
  const services = env.services;
  const toBeDeployed = new Set(registry.getAll());
  let service: Service | null = null;

  while ((service = findNext())) {
    toBeDeployed.delete(service);
    const value = await service.deploy(env);
    services[service.name] = value;
  }
  if (toBeDeployed.size) {
    throw new Error("Some services could not be deployed");
  }

  function findNext(): Service | null {
    for (let s of toBeDeployed) {
      if (s.dependencies) {
        if (s.dependencies.every((d) => d in services)) {
          return s;
        }
      } else {
        return s;
      }
    }
    return null;
  }
}
