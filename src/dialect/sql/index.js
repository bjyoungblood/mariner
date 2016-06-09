import {
  InvalidMigrationError,
  NoDownMigrationError,
} from '../../errors';

export Store from './store';
import fs from 'fs';
import Promise from 'bluebird';
import Store from './store';
import SQLStub from './migration.stub';

const UP_DELIMITER = '---!> MARINER:MIGRATE:UP:';
const DOWN_DELIMITER = '---!> MARINER:MIGRATE:DOWN:';

const UP = 'up';
const DOWN = 'down';

export default class sqlDialect {
  static Store = Store;

  static check(extension) {
    return extension === 'sql';
  };

  constructor(mariner, options) {
    this.mariner = mariner;
    this.options = options;
    this.store = new Store(options);
  }

  getSql(direction, name) {
    return this.mariner.getMigrationContent(direction, name)
    .then((sql) => {
      let promise;

      if (direction === UP) {
        promise = this.getUpMigration(sql, name);
      } else if (direction === DOWN) {
        promise = this.getDownMigration(sql, name);
      } else {
        throw new Error('Invalid direction');
      }

      return promise;
    });
  }

  getUpMigration(sql, name) {
    const lines = sql.split('\n');
    const output = [];

    let adding = false;

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

  migrate(direction, name) {
    return this.getSql(direction, name).then((sql) => {
      return this.store.execute(sql);
    });
  }

  create(dest, options) {
    return new Promise((resolve, reject) => {
      return fs.writeFile(dest, SQLStub, (err) => {
        return err ? reject(err) : resolve(dest);
      });
    });
  }
}
