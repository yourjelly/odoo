## Point of Sale cache system.

This module helps to reduce the impact of the loading of the PoS on the server by 
taking a snapshot of the data during a scheduled action, and then using this snapshot
when loading the PoS.

### Enabling the cache system.

The cache system can be toggled on and off for each PoS config in its setting.\
Please note that the caches are only generated for configurations marked as "Using cache"
at the moment of the scheduled action.\
When using the cache system, limited products and partners loading must be turned off.

When installing the module, the cache system will be enabled for all PoS configs, and
the limited loading will be disabled.

### How does it work.

The cache is loaded immediately after opening a PoS session.\
The PoS will then proceed to load the entirety of the cache before showing the UI.\

This brings multiple benefits:
* It could happen that the server would run out of memory and crash when the PoS was loading
a large amount of data without background loading. It won't happen with the cache.
* When using background loading, the PoS UI would be shown while loading data, and it would suffer
from micro freezes while processing the new data received. It won't happen with the cache.
* The cache being already pre-processed, the performance impact on the server is greatly reduced.\
It means that the impact of the PoS on users using the other Odoo apps is reduced.

At the cost of a few things:
* The cache is not updated in real-time. It is only updated when the scheduled action is triggered.
* The initial loading of the PoS will take longer, but the loading time will be more constant when many users are using it in parallel.

### FAQ

**Q: I want to update a product during the day and see the changes in the PoS. Is it possible?**

A: Yes, there is a view in the general Odoo settings to display the caches, their size in Mb, and the last
refresh time and date.
On this view, you can refresh a specific cache to rebuild it with the latest data.\
Once rebuilt, you will need to refresh the PoS session to load the new cache.

**Q: What is a good time for the automatic cache refresh to be run?**

A: It will depend on the usage. You will want the cache to be refreshed between the time the last changes in
the database are made, and the time the first users will start using the PoS.\
As the cache refresh time depends on the PoS system itself and could vary greatly depending on it, it is
recommended to run it during the night or early morning.\
By default, the cache should take a few minutes to be refreshed.

**Q: There was an issue during the update of the cache and the data seems wrong/corrupted/... What can be done?**

A: While this shouldn't happen, there is a mechanism in place to delete all existing caches and then
rebuild them called "Reset POS Caches".\
You can find it in the general Odoo settings, in the "POS Caches" section.

**Q: How are the data stored?**

A: When refreshing the cache, the data is loaded from the database and then processed as it would when
loading the PoS\
This is done using the exact same mechanism as the PoS loading itself, so any inheritance is still applied.\
Once processed, the data will be stored in the database as a JSON string ready to be loaded when needed, 
without the need to do any processing or filtering.
