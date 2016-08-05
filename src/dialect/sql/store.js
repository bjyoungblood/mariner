import _ from 'lodash';
import knex from 'knex';
import {
  Store,
} from '../../mariner';

export default class sqlStore extends Store {
  static client;

  constructor(options) {
    super(...arguments);

    this.options = {
      ...options,
    };

    if (options.isBackend) {
      this.tableName = options.tableName || 'migrations';
      this.listItems = null;
    }
  }

  init() {
    const client = this.getClient();

    return this.options.isBackend ? (
      client.schema.hasTable(this.tableName)
      .then((exists) => {
        return exists ? null : client.schema.createTable(this.tableName, (table) => {
          table.increments('id').primary();
          table.string('name').unique().notNullable();
          table.dateTime('migration_time').notNullable();
        });
      })
    ) : null;
  }

  getClient() {
    if (! sqlStore.client) {
      sqlStore.client = knex(this.options);
    }

    return sqlStore.client;
  }

  execute(query, bindings = []) {
    const client = this.getClient();

    return client.raw(query, bindings);
  }

  record(name) {
    const client = this.getClient();

    return client(this.tableName).insert({
      name,
      migration_time : new Date(),
    });
  }

  delete(name) {
    const client = this.getClient();

    return client(this.tableName).delete()
    .where('name', name);
  }

  list() {
    const client = this.getClient();

    return client(this.tableName).select('name')
    .orderBy('name')
    .then((result) => {
      return _.map(result, 'name');
    });
  }
}
