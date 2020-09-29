# Services

## Overview

The Odoo web client is organized in _components_. It is common for a component
to have a need to perform tasks or obtain some information outside of itself.

For example:

- performing an RPC
- displaying a notification
- asking the web client to change the current action/view
- ...

These kind of features are represented in the web client under the name _service_.
A service is basically a piece of code that is started with the web client, and
available to the interface (and to other services).

## Defining a service

A service needs to follow the following interface:

```ts
interface Service {
  name: string;
  dependencies?: string[];
  start(env: OdooEnv): any;
}
```

The name is simply a short unique string representing the service, such as `rpc`.
It may define some `dependencies`. In that case, the dependent services will be
started first, and ready when the current service is started.

Finally, the `start` method is the most important: it will be executed as soon
as the service infrastructure is deployed (so, even before the web client is
instantiated), and the return value of the `start` method will be the value of
the service.

TODO: explain how a service can access a dependent service.

Once a service is defined, it needs then to be registered to the `serviceRegistry`,
to make sure it is properly deployed when the application is started.

```ts
serviceRegistry.add(myService.name, myService);
```

For example, imagine that we want to provide a service that manage a counter.
It could be defined like this:

```js
const counterService = {
  name: "counter",
  start(env) {
    let value = 0;
    return {
      getValue() {
        return value;
      },
      increment() {
        value++;
      },
    };
  },
};
serviceRegistry.add(counterService.name, counterService);
```

## Using a service

To use a service, a component needs to call the `useService` hook. This will
return a reference to the service value, that can then be used by the component.

For example:

```js
class MyComponent extends Component {
    rpc = useService('rpc');

    async willStart() {
        this.someValue = await this.rpc(...);
    }
}
```

Note: IF the value of the service is a function (for example, like the `rpc`
service), then the `useService` hook will bind it to the current component. This
means that the code for the service can actually access the component reference.

## RPC service

The RPC service is necessary to properly send a request to the server. The value
of the service is a function that takes a query and return a promise (which will
be resolved to the result of the query).

Here is the type of the query:

```ts
interface RPCRouteQuery {
  route: string;
  params?: { [key: string]: any };
}

interface RPCModelQuery {
  model: string;
  method: string;
  args?: any[];
  kwargs?: { [key: string]: any };
}

type RPCQuery = RPCRouteQuery | RPCModelQuery;
```

#### Calling a controller

As the type of the query shows, there are actually two different ways to call
the `rpc` method. Either we call a route, or calling a method on a model. Here
is an example of calling a route:

```ts
const result = await this.rpc({ route: "/my/route", params: { some: "value" } });
```

#### Calling a model

To call a model, we need to specify a model, a method, args and/or kwargs. For
example:

```ts
const result = await this.rpc({
  model: "res.partner",
  method: "read",
  args: [[123]],
});
```

#### Notes

- If an rpc fails, then an event `RPC_ERROR` will be triggered on the main bus.

- user context is automatically added to every query. If the query defines
  explicitely a context, the user context will be expanded with the query
  context.

- if a query is initiated by a component, the `rpc` service will check if the
  component is destroyed when the query is completed. In that case, it will
  leave the query pending, so no additional code is executed.

## Notification service

TODO

## Router service

The `router` service provides three features:

- the current route can be accessed (`router.current`). It contains the current
  path, search query object and hash query object,
- it listens to every (external) hash changes, and trigger a `ROUTE_CHANGE` event
  on the main bus,
- it provides a `pushState(hashQuery, replace=false)` method to update (or replace)
  the current hash (without triggering a `ROUTE_CHANGE` event).

## ActionManager service

TODO
