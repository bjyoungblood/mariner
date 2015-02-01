#!/usr/bin/env node
'use strict';

require('./promisify');

var Promise = require('bluebird');
var program = require('commander');
var pg = require('pg');
var path = require('path');

var Migrate = require('./migrate');
var Store = require('./pg-store');
var MarinerError = require('./errors').MarinerError;

function getClient(connectionString) {
  return new Promise(function(resolve, reject) {
    var client = new pg.Client(connectionString);
    client.connect(function(err) {
      if (err) {
        return reject(err);
      }

      return resolve(client);
    });
  }).disposer(function(client) {
    return client.end();
  });
}

var defaultPath = path.join(process.cwd(), 'migrations');
var defaultDb = process.env.POSTGRES_URL || process.env.DATABASE_URL;

program.version(require('../package.json').version);

program.command('create <name>')
  .option('-d, --directory <directory>', 'Path to migrations', defaultPath)
  .description('Create a new database migration')
  .action(function(name, options) {
    var migrate = new Migrate(options.directory);
    migrate
      .create(name)
      .then(function(created) {
        console.log('Created:', created);
      })
      .catch(MarinerError, function(err) {
        console.error(err.message);
        process.exit(1);
      })
      .catch(function(err) {
        console.error(err.stack);
        process.exit(1);
      });
  });

program.command('migrate <direction>')
  .option('-n, --number <number>', 'How many migrations to run', null)
  .option('-c, --connection <connection>', 'Database connection string', defaultDb)
  .option('-d, --directory <directory>', 'Path to migrations', defaultPath)
  .description('Run database migrations; up defaults to running all, down defaults to running last')
  .action(function(direction, options) {
    var count = options.number ? Number(options.number) : null;

    Promise.using(getClient(options.connection), function(client) {
      var store = new Store(client);
      var migrate = new Migrate(options.directory, store);

      return migrate.init()
        .then(function() {
          return migrate.run(direction, count);
        });
    });
  });

program.parse(process.argv);
