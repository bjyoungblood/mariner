import {
  DialectMissingMethod,
} from './errors';

export default class Store {
  init() {}

  record(name) {
    throw new DialectMissingMethod(this.constructor.name, 'record');
  }

  delete(name) {
    throw new DialectMissingMethod(this.constructor.name, 'delete');
  }

  list() {
    throw new DialectMissingMethod(this.constructor.name, 'list');
  }
}
