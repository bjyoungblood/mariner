import _ from 'lodash';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { format } from 'util';
import Promise from 'bluebird';
import chalk from 'chalk';

import Store from './store';

import {
  MigrationsDirectoryNotFoundError,
  MigrationExistsError,
  MigrationMissingError,
  RuntimeMigrationError,
  DialectUnknown,
} from './errors';

const UP = 'up';
const DOWN = 'down';

const MIGRATION_PATTERN = /^\d{14}_[A-Za-z0-9\-]+\./;
const MIGRATION_NAME_FILTER = /[^A-Za-z0-9\-]+/g;

function pathExists(pth) {
  return new Promise((resolve, reject) => {
    fs.exists(pth, (exists) => {
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
  constructor(options) {
    assert(_.isString(options.directory), 'Migrate must be passed a migrations directory');
    this.migrationsDir = options.directory;

    if (options.backendStore) {
      this.setStore(options.backendStore, options);
    } else {
      throw new Error('No backend provided for persistence');
    }

    assert(
      this.store instanceof Store,
      'Specified backend is not an instance of Mariner#Store'
    );

    options.dialects = _.mapValues(options.dialects, (Dialect, key) => {
      return new Dialect(this, options[ key ] || {}, options);
    });

    this.options = options;
  }

  init() {
    const options = this.options;

    return pathExists(this.migrationsDir)
      .then((exists) => {
        if (! exists) {
          throw new MigrationsDirectoryNotFoundError();
        }

        return fs.readdirAsync(this.migrationsDir);
      })
      .then((migrationFiles) => {
        this.migrations = _.filter(migrationFiles, (file) => {
          if (! this.getDialect(file)) {
            const warning = chalk.yellow(
              `${chalk.red('[WARNING]')} skipping ${file}, no dialect/plugin`
            );

            if (this.options.stopOnWarning) {
              throw new DialectUnknown(this.getDialectFromFile(file));
            } else {
              console.log(warning); // eslint-disable-line no-console
            }
          }

          return file.match(MIGRATION_PATTERN);
        });
      })
      .then(() => {
        return this.store.init(_.get(options, options.backend, {}));
      });
  }

  setStore(store, options = this.options) {
    if (_.isFunction(store)) {
      const storeOptions = options[ options.backend ] || {};

      storeOptions.isBackend = true;

      store = new store(storeOptions, options);
      store.init = Promise.method(store.init.bind(store));
    }

    assert(store instanceof Store, 'store must be an instance of Store');

    this.store = store;
  }

  computeUpDiff() {
    return this.store.list().then((migrations) => {
      // Ensure all the migrations in the database exist
      const missing = _.difference(migrations, this.migrations);

      if (missing.length) {
        throw new MigrationMissingError(missing);
      }

      const newMigrations = _.difference(this.migrations, migrations);

      // Migrations should be sorted, but _.difference does not document stability
      newMigrations.sort();

      return newMigrations;
    });
  }

  getDownCandidates() {
    return this.store.list()
      .then((migrations) => migrations.reverse());
  }

  run(direction, count = null) {
    let promise;

    assert(direction === UP || direction === DOWN, 'direction must be one of: up, down');

    if (count !== null) {
      if (! _.isNumber(count) || count <= 0) {
        throw new Error('count must be a positive integer when provided');
      }
    }

    if (direction === 'up') {
      promise = this.computeUpDiff()
        .then((migrations) => {
          if (count) {
            migrations = migrations.slice(0, count);
          }

          return Promise.each(migrations, (name) => this.runOne(direction, name));
        });
    } else {
      promise = this.getDownCandidates()
        .then((migrations) => {
          if (! count) {
            count = 1;
          }

          migrations = migrations.slice(0, count);

          return Promise.each(migrations, (name) => this.runOne(direction, name));
        });
    }

    return promise;
  }

  runOne(direction, name) {
    assert(direction === UP || direction === DOWN, 'direction must be one of: up, down');

    const dialect = this.getDialect(name);

    assert(dialect, `unknown dialect for migration file: ${name}`);

    const migrate = Promise.method(dialect.migrate.bind(dialect));

    return migrate(direction, name)
      .then(() => {
        return direction === UP ? this.store.record(name) :
                                  this.store.delete(name);
      })
      .tap(() => {
        if (direction === UP) {
          console.log('⛵\tUP: %s', name); // eslint-disable-line no-console
        } else {
          console.log('⛵\tDOWN: %s', name); // eslint-disable-line no-console
        }
      })
      .catch((e) => {
        throw new RuntimeMigrationError(name, e);
      });
  }

  getDialectFromFile(file) {
    return path.extname(file).replace('.', '');
  }

  getDialect(name) {
    const ext = this.getDialectFromFile();

    return _.find(this.options.dialects, (dialect) => {
      return dialect.constructor.check(ext);
    });
  }

  getMigrationPath(name) {
    return path.join(this.migrationsDir, name);
  }

  getMigrationContent(direction, name) {
    let filename = this.getMigrationPath(name);

    return fs.readFileAsync(filename, { encoding : 'utf8' });
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
  create(name, options) {
    const filename = format(
      '%s_%s.%s',
      timestamp(),
      name.replace(MIGRATION_NAME_FILTER, '-'),
      options.extension,
    );

    const destPath = path.join(this.migrationsDir, filename);

    return pathExists(this.migrationsDir)
      .then((exists) => {
        return exists ? null : fs.mkdir(this.migrationsDir);
      })
      .then(() => pathExists(destPath))
      .then((exists) => {
        if (exists) {
          throw new MigrationExistsError();
        }

        return this.getDialect(filename);
      })
      .then((dialect) => {
        if (! dialect) {
          throw new DialectUnknown(options.extension);
        }

        return dialect.create(destPath, options);
      });
  }

}
