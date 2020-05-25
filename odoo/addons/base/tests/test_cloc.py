#!/usr/bin/python
xml_test = """<?xml version="1.0" encoding="UTF-8"?>
https://github.com/odoo/odoo/compare/13.0...odoo-dev:13.0-maintenance-cloc-al?expand=1
https://github.com/odoo-dev/odoo/blob/13.0-maintenance-cloc-al/cloc.py
<odoo>
    <![CDATA[<!-- doesnt work no]]>
    no
    <!-- no -->
    yes2
    <!-- no
    no
    no-->
    yes1 cdata
    <![CDATA[yes4]]>
    <![CDATA[yes5
    yes6]]>
    cdata and comment
    <![CDATA[<!--no-->]]>
    <![CDATA[<!--no
    no
    -->]]>
    comment and cdata et
    <!-- <![CDATA[no]]> -->
    <!-- <![CDATA[
    line4]]> -->
</odoo>
"""

py_test = '''
# comment 1

def func(): # eol comment 3
    """ docstring
    """
    pass

print i.lineno, i,  getattr(i,'s',None), getattr(i,'value',None)
'''

js_test = '''
/*
comment
*/

function() {
    return 1+2; // comment
}
'''
