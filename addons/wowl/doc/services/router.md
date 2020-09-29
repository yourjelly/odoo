# Router service

The `router` service provides three features:

- the current route can be accessed (`router.current`). It contains the current
  path, search query object and hash query object,
- it listens to every (external) hash changes, and trigger a `ROUTE_CHANGE` event
  on the main bus,
- it provides a `pushState(hashQuery, replace=false)` method to update (or replace)
  the current hash (without triggering a `ROUTE_CHANGE` event).
