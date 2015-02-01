'use strict';

import _ from 'lodash';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { format } from 'util';
import Promise from 'bluebird';

import Store from './pg-store';

import {
  MigrationsDirectoryNotFoundError,
  MigrationExistsError,
  MigrationMissingError,
  InvalidMigrationError,
  NoDownMigrationError,
} from './errors';

const UP = 'up';
const DOWN = 'down';

const UP_DELIMITER = '---!> MARINER:MIGRATE:UP:';
const DOWN_DELIMITER = '---!> MARINER:MIGRATE:DOWN:';

const MIGRATION_PATTERN = /^\d{14}_[A-Za-z0-9\-]+\.sql$/;
const MIGRATION_NAME_FILTER = /[^A-Za-z0-9\-]+/g;

const STUB_PATH = __dirname + '/../sql/migration.stub.sql';

function pathExists(path) {
  return new Promise(function(resolve, reject) {
    fs.exists(path, function(exists) {
      resolve(exists);
    });
  });
}

function pad(str) {
  return _.padLeft(String(str), 2, '0');
}

function timestamp() {
  var d = new Date();

  return d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds());
}

export default class Migrate {
  constructor(migrationsDir, store) {
    assert(_.isString(migrationsDir), 'Migrate must be passed a migrations directory');
    this.migrationsDir = migrationsDir;

    this.store = null;

    if (store) {
      this.setStore(store);
    }
  }

  init() {
    return pathExists(this.migrationsDir)
      .then((exists) => {
        if (! exists) {
          throw new MigrationsDirectoryNotFoundError();
        }

        return fs.readdirAsync(this.migrationsDir);
      })
      .then((migrationFiles) => {
        this.migrations = _.filter(migrationFiles, (file) => file.match(MIGRATION_PATTERN));
      });
  }

  setStore(store) {
    assert(store instanceof Store, 'store must be an instance of Store');
    this.store = store;
  }

  computeUpDiff() {
    return this.store.listRunMigrations().then((migrations) => {

      var dbMigrations = _.pluck(migrations, 'name');

      // Ensure all the migrations in the database exist
      var missing = _.difference(dbMigrations, this.migrations);
      if (missing.length) {
        throw new MigrationMissingError(missing);
      }

      var newMigrations = _.difference(this.migrations, dbMigrations);

      // Migrations should be sorted, but _.difference does not document stability
      newMigrations.sort();

      return newMigrations;
    });
  }

  getDownCandidates() {
    return this.store.listRunMigrations()
      .then((migrations) => _.pluck(migrations, 'name').reverse());
  }

  run(direction, count = null) {
    assert(direction === UP || direction === DOWN, 'direction must be one of: up, down');

    if (count !== null) {
      if (! _.isNumber(count) || count <= 0) {
        throw new Error('count must be a positive integer when provided');
      }
    }

    if (direction === 'up') {
      return this.computeUpDiff()
        .then((migrations) => {
          if (count) {
            migrations = migrations.slice(0, count);
          }

          return Promise.each(migrations, (name) => this.runOne(direction, name));
        });
    } else {
      return this.getDownCandidates()
        .then((migrations) => {
          if (! count) {
            count = 1;
          }

          migrations = migrations.slice(0, count);

          return Promise.each(migrations, (name) => this.runOne(direction, name));
        });
    }
  }

  runOne(direction, name) {
    assert(direction === UP || direction === DOWN, 'direction must be one of: up, down');

    return this.getMigrationSqlFromFile(direction, name)
      .then((sql) => this.store.migrate(direction, name, sql));
  }

  getMigrationSqlFromFile(direction, name) {
    let filename = path.join(this.migrationsDir, name);

    return fs.readFileAsync(filename, { encoding : 'utf8' }).then((sql) => {

      if (direction === UP) {
        return this.getUpMigration(sql, name);
      } else if (direction === DOWN) {
        return this.getDownMigration(sql, name);
      } else {
        throw new Error('Invalid direction');
      }

    });
  }

  getUpMigration(sql, name) {
    var lines = sql.split('\n');
    var output = [];

    var adding = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].indexOf(UP_DELIMITER) === 0) {
        adding = true;
        continue;
      }

      if (lines[i].indexOf(DOWN_DELIMITER) === 0) {
        break;
      }

      if (adding) {
        output.push(lines[i]);
      }
    }

    if (output.length === 0) {
      throw new InvalidMigrationError(name);
    }

    return output.join('\n');
  }

  getDownMigration(sql, name) {
    var lines = sql.split('\n');
    var output = [];

    var adding = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].indexOf(DOWN_DELIMITER) === 0) {
        adding = true;
        continue;
      }

      if (adding) {
        output.push(lines[i]);
      }
    }

    if (output.length === 0) {
      throw new NoDownMigrationError(name);
    }

    return output.join('\n');
  }

  /**
   * Creates a new migration in the migrations directory from the stub using the
   * given name.
   *
   * File name format:
   *   YYYYMMDDHHMMSS_migration-name.sql
   *
   * Any non-alphanumeric characters in name will be replaced with dashes.
   *
   * @param  {string} name Migration name
   * @return {Promise}
   */
  create(name) {
    return new Promise((resolve, reject) => {
      var filename = format(
        '%s_%s.sql',
        timestamp(),
        name.replace(MIGRATION_NAME_FILTER, '-')
      );

      var destPath = path.join(this.migrationsDir, filename);

      return pathExists(destPath)
        .then((exists) => {
          if (exists) {
            throw new MigrationExistsError();
          }

          var source = fs.createReadStream(STUB_PATH);
          var dest = fs.createWriteStream(destPath);

          source.on('error', reject);
          dest.on('error', reject);

          dest.on('finish', () => resolve(destPath));

          source.pipe(dest);
        });

    });
  }

}
