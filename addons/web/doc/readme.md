# Current State of (developer) Doc

awful...
Tutorials: 
- click on title open a specific page with LESS information! 
      ==> it should zoom into tutorials, and keep all sub sections
- Getting Started: decent part of the documentation. but mixes way too much
  explanations with tutorial

Reference:
- clicking on main Reference in navbar only unfold navbar => there is no complete page named "/documentation/master/developer/reference.html"


# Odoo Developer Documentation TOC



Tutorials
    Getting Started
        1. Development environment setup
        2. A new application
        3. Models and Basic Fields
        4. Security - A Brief Introduction
        5. Finally, Some UI To Play With
        6. Basic Views
        7. Relations Between Models
        8. Computed Fields And Onchanges
        9. Ready For Some Action?
        10. Constraints
        11. Add The Sprinkles
        12. Inheritance
        13. Interact With Other Modules
        14. A Brief History Of QWeb
        15. The final word
    Going Further
        16. Define module data
        17. Restrict access to data
        18. Safeguard your code with unit tests
        19. Build PDF Reports
    Discover the JS Framework
        20. Owl Components
        21. Build a dashboard
    Master the Odoo Web Framework
        22. Build a clicker game
        23. Create a Gallery view
        24. Customize a kanban view

How-to guides
    Subclass a field component (js)
    Create a new field component (js)
    Create a new view from scratch (js)
    Subclass an existing view (js)
    Create a client action (js)
    Create a standalone owl application (js)
    Create a new Odoo module
    Connect to Odoo using json-rpc
    Write a reporting model using SQL views
    Make an accounting localization

Reference
        
    Python Framework
        Core concepts
        Structure of a module
        Module Manifest
        ORM
        Data files
        Action models
        Testing
        Translations

    Javascript framework
        Core concepts
        Managing Assets
        Owl Framework
        Registries
        Components
        Hooks
        Services
        Utils
        Web Client
        Relational Model
        Testing

    Views and Fields
        View models
        Views
        Fields

    Reporting
        QWeb reports
        Report actions
        ir.actions.report model


    Website 
        Setup
        Theming
        Layout
        Navigation
        Pages
        Building blocks
        Shapes
        Gradients
        Animations
        Forms
        Translations
        Going live

    Accounting

    Payment


Information
    Architecture Overview
    The anatomy of a Odoo module
    A short introduction to the JS framework
    Coding Guidelines
    Styling guidelines
    Tooling


# Detail of some pages:

Python Framework/Core concepts
    Multi-company 


# Concrete changes

- move getting started/chapter1: architecture overview to Informations section
- remove "Reuse code with mixins" tutorial
- move write lean easy-to-maintain css to Styling guidelines info page
- split customize a field into 2 howtos (subclass and create)
- split customize a view into 2 howtos (subclass and create)
- create "create a new odoo module" howto
- rename the "Web services" how-to to "Connect do odoo using json-rpc"
- rename create customized reports => write a reporting model using sql views
- move translating modules to reference