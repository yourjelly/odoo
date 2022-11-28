### Unremovable nodes
*see isUnremovable @ utils.js*
* any node different than element or text
* editable root node
* element (any):
    * class 'o_editable' 
    * has attributes 't-set' or 't-call' (QWeb stuff)
    * class 'oe_unremovable' *(oe is odoo editor in this case...)*
* node is not a descendant of editable

### Unbreakable nodes
*see isUnbreakable @ utils.js*
* TEXT_NODE is not unbreakable
* any node different than ELEMENT is unbreakable
* element (any):
    * unremovable node
    * table-related (thead, tbody, tfoot, tr, th, td)
    * section or div
    * tag "t" `<t>`
    * contains t-* attributes (QWeb stuff)
    * class oe_unbreakable

### Sanitize
Weird class in which the constructor does all the job.
It traverses the whole tree rooted at the closestBlock from the node passed as argument, and does the following tasks: 
* merge identical elements together (example?)
* remove zero-width spaces
* transform `<li>` into paragraphs if not in an `<ul>` or `<ol>`
* put zws inside FA element
* ensure editor tabs align on a grid
* set contenteditable to false in media or HR (horizontal rule) elements
* update href attr in link (`<a>`) elements

## oe Classes
* oe_tabs: tab (tabulation). An EditorTab is a **span** element with **oe_tabs** class
* o_dirty: the editable has changes to be saved



## Rollback
How rollback is set to happen:
set this._toRollback to one of the codes (UNBREAKABLE_ROLLBACK_CODE, UNREMOVABLE_ROLLBACK_CODE )
when historyStep() runs, it calls this.historyRollback()


the MutationObserver calls the callback passing an array of MutationRecord

observerApply() is called in these callback and processes each of these records, pushing them to this.currentStep.mutations.
It also sets the this._toRollback flag upon childList changes

this.currentStep is set by _historyClean to a bunch of undefineds and its mutations property to an empty array
it's also reset by historyStep()




TO CHECK:
* historyRollback()
* filterMutationRecords

* unique ids for checklists
* serializeNode    
* focus and selection
* JS event loop (and then recheck automaticStepSkipStack)
* events dispatched (contentChanged, preObserverActive, observerActive, etc)
* why so many observerFlush()ing?

TO DIG IN:
block x inline, breakable
what content-editable does
focus: Selection x focus with tab

## Odoo Editor
* It lets contenteditable do the job, but watches for changes in the DOM with a MutationObserver, records them, and reverts them in case of undesirable changes

* the observer can be deactivated
