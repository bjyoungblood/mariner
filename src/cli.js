#!/usr/bin/env node
import './promisify';

import program from 'commander';
import path from 'path';
import fs from 'fs';
import _ from 'lodash';
import nb from 'node-beautify';

import Migrate from './migrate';
import {
  MarinerError,
  NoConfigError,
} from './errors';

import jsDialect from './dialect/js/index';
import sqlDialect from './dialect/sql/index';

const filename = path.join(process.cwd(), 'mariner.js');
const defaultPath = path.join(process.cwd(), 'migrations');

function getConfig() {
  const exists = fs.existsSync(filename);
  const cfg = exists ? require(filename) : {};

  if (cfg.directory) {
    cfg.directory = path.resolve(process.cwd(), cfg.directory);
  } else {
    cfg.directory = defaultPath;
  }

  return cfg;
}

function ensureConfig() {
  if (! fs.existsSync(filename)) {
    throw new NoConfigError();
  }
}

function initDialects(config) {
  config.dialects = _.transform(config.plugins, (dialects, plugin) => {
    if (_.isString(plugin)) {
      const name = plugin.indexOf('mariner-') !== -1 ? name : `mariner-${name}`;
      const isSql = plugin === 'sql';
      const isInternal = isSql || plugin === 'js';

      if (isInternal) {
        dialects[ plugin ] = isSql ? sqlDialect : jsDialect;
      } else {
        dialects[ name.replace('mariner-', '') ] = require(name);
      }
    } else if (_.isArray(plugin)) {
      dialects[ plugin[0] ] = plugin[1];
    }
  });
}

function initBackend(config) {
  const full = config.backend.indexOf('mariner-') !== -1 ? config.backend :
                                                           `mariner-${config.backend}`;
  const short = full.replace('mariner-', '');
  let backend = config.dialects[ short ];

  if (! backend) {
    try {
      backend = require(full);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
    }
  }

  backend = backend && backend.Store ? backend.Store : backend;

  config.backend = short;
  config.backendStore = backend;

  return config;
}

function init() {
  const config = getConfig();

  initDialects(config);

  if (config.backend) {
    initBackend(config);
  }

  return config;
}

const config = init();

program.version(require('../package.json').version);

program.command('create <name...>')
  .option('-e, --extension <extension>', 'Dialect Extension', 'sql')
  .description('Create a new database migration')
  .action(function(name, command) {
    ensureConfig();

    name = name.join('-');

    const options = command.opts();

    const migrate = new Migrate(config);

    migrate
      .create(name, options)
      .then((created) => {
        console.log('Created:', created); // eslint-disable-line no-console
      })
      .catch(MarinerError, (err) => {
        console.error('⛵\tERROR: ', err.message);  // eslint-disable-line no-console
        process.exit(1);
      })
      .catch((err) => {
        console.error(err.stack);  // eslint-disable-line no-console
        process.exit(1);
      });
  });

program.command('init')
  .option('-d --directory <directory>', 'Path to migrations', './migrations')
  .option('-b --backwards', 'Backwards compatibilty', false)
  .description('Generate the default .mariner configuration file')
  .action(function(command) {
    const options = command.opts();

    const shim = options.backwards ? `
      // see list of available options at http://knexjs.org
      sql: {
        client: 'pg',
        connection : process.env.DATABASE_URL || process.env.POSTGRES_URL,
      },

      backend : 'sql',
    ` : `
      // see list of available options at http://knexjs.org
      sql: {},

      backend: 'sql',
    `;

    const output = `
      'use strict';

      module.exports = {
        directory: '${options.directory}',

        stopOnWarning: true,

        plugins: [
          'sql',
          'js'
        ],

        ${shim.trim()}
      };
    `;

    const code = nb.beautifyJs(output.trim(), {
      indentSize : 2,
    });

    fs.writeFileSync(path.join(process.cwd(), 'mariner.js'), code);

    console.log('⛵\tInit: ', 'Configuration file generated'); // eslint-disable-line
  });

program.command('migrate <direction>')
  .option('-n, --number <number>', 'How many migrations to run', null)
  .description('Run database migrations; up defaults to running all, down defaults to running last')
  .action(function(direction, command) {
    ensureConfig();

    const options = command.opts();
    const count = options.number ? Number(options.number) : null;

    const migrate = new Migrate(config);

    return migrate.init()
    .then(() => {
      return migrate.run(direction, count);
    })
    .then(() => {
      process.exit(0);
    })
    .catch(MarinerError, (err) => {
      console.error('⛵\tERROR: ', err.message);  // eslint-disable-line no-console
      process.exit(1);
    })
    .catch((err) => {
      console.error(err.stack);  // eslint-disable-line no-console
      process.exit(1);
    });;
  });

program.parse(process.argv);
