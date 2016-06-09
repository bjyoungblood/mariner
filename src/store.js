import {
  DialectMissingMethod,
} from './errors';

export default class Store {
  init() {}

  migrate(direction, name, sql) {
    throw new DialectMissingMethod(this.constructor.name, 'migrate');
  }

  list() {
    throw new DialectMissingMethod(this.constructor.name, 'list');
  }
}
