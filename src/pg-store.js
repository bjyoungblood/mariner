'use strict';

import assert from 'assert';
import fs from 'fs';
import { format } from 'util';
import _ from 'lodash';
import pg from 'pg';
import Promise from 'bluebird';
import squel from 'squel';

squel.useFlavour('postgres');

const UP = 'up';

const CHECK_TABLE = 'SELECT * FROM information_schema.tables WHERE table_name = $1';
const LIST_RUN_MIGRATIONS = 'SELECT * FROM %s ORDER BY name';

export default class Store {
  constructor(client, tableName = 'migrations') {
    assert(client instanceof pg.Client, 'Store must be passed an instance of pg.Client');

    this.client = client;
    this.tableName = tableName;
    this.runMigrations = null;
  }

  execute(query, bindings = []) {
    return new Promise((resolve, reject) => {
      this.client.query(query, bindings, (err, result) => {
        if (err) {
          return reject(err);
        }

        return resolve(result);
      });
    });
  }

  migrate(direction, name, sql) {
    if (direction === UP) {
      return this.execute(sql)
        .then(() => this.recordMigration(name));
    } else {
      return this.execute(sql)
        .then(() => this.deleteMigration(name));
    }
  }

  recordMigration(name) {
    var query = squel.insert()
      .into(this.tableName)
      .set('name', name)
      .toParam();

    return this.execute(query.text, query.values);
  }

  deleteMigration(name) {
    var query = squel.delete()
      .from(this.tableName)
      .where('name = ?', name)
      .toParam(0);

    return this.execute(query.text, query.values);
  }

  checkMigrationsTable() {
    return this.execute(CHECK_TABLE, [ this.tableName ])
      .then((result) => {
        if (! result.rows[0]) {
          return false;
        } else {
          return true;
        }
      });
  }

  assertMigrationsTable() {
    return this.checkMigrationsTable()
      .then((exists) => {
        if (exists) {
          return;
        }

        return this.createMigrationsTable();
      });
  }

  createMigrationsTable() {
    return fs.readFileAsync(__dirname + '/../sql/migration-table.sql', { encoding : 'utf8' })
      .then((sql) => format(sql, this.tableName))
      .then((sql) => this.execute(sql));
  }

  listRunMigrations() {
    if (this.runMigrations) {
      return Promise.resolve(_.clone(this.runMigrations));
    }

    return this.assertMigrationsTable()
      .then(() => this.execute(format(LIST_RUN_MIGRATIONS, this.tableName)))
      .then((result) => {
        this.runMigrations = result.rows;

        return _.clone(this.runMigrations);
      });
  }
}
