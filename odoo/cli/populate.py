#!/usr/bin/env python
# -*- coding: utf-8 -*-
from __future__ import print_function

import time

import logging
import optparse
import odoo
from . import Command
_logger = logging.getLogger(__name__)


class Populate(Command):

    def run(self, cmdargs):
        parser = odoo.tools.config.parser
        group = optparse.OptionGroup(parser, "Populate Configuration")
        group.add_option("--populate-level", dest="populate_level",
                    help="Populate database with auto-generated data. Value should be the population size: low, medium or high",
                    my_default='low')
        group.add_option("--populate-models",
                         dest='populate_modules',
                         help="Only instanciate specified models")
        parser.add_option_group(group)
        opt = odoo.tools.config.parse_config(cmdargs)
        populate_modules = opt.populate_modules and set(opt.populate_modules.split(','))
        populate_level = opt.populate_level

        with odoo.api.Environment.manage():
            dbname = odoo.tools.config['db_name']
            registry = odoo.modules.registry.Registry.new(dbname)
            cr = registry.cursor()
            env = odoo.api.Environment(cr, odoo.SUPERUSER_ID, {})
            _logger.log(25, 'Populating database')
            for model in env.values(): # todo, order models ? or manualy _populate_database on needed model and skip
                ir_model = env['ir.model'].search([('model', '=', model._name)])
                # TODO filter with param
                if populate_modules and model._name not in populate_modules:
                    continue
                if model._transient or model._abstract:
                    continue
                if all(module.startswith('test_') for module in ir_model.modules.split(',')):
                    continue
                if False and not model.search([]):
                    _logger.warning('%s is empty', model._name)
                if not 'res.partner' in model._name:
                    continue
                _logger.info('Populating database for model %s', model._name)
                t0 = time.time()
                model._populate_database(populate_level)
                cr.commit() # todo indicate somewhere that model is populated
                model_time = time.time() - t0
                if model_time > 1:
                    _logger.info('Populated database for model %s in %ss', model._name, model_time)
            cr.close()
