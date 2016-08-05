import { format } from 'util';

export class MarinerError extends Error {
  constructor(message, code) {
    super(...arguments);
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.message = message;
    this.code = code;
  }
}

export class MigrationsDirectoryNotFoundError extends MarinerError {
  constructor(...args) {
    super(...args);

    this.name = 'MigrationsDirectoryNotFoundError';
    this.message = 'Migrations directory not found';
  }
}

export class MigrationExistsError extends MarinerError {
  constructor(...args) {
    super(...args);

    this.name = 'MigrationExistsError';
    this.message = 'Migration already exists';
  }
}

export class MigrationMissingError extends MarinerError {
  constructor(list, ...args) {
    super(...args);

    list = list || [];

    this.name = 'MigrationMissingError';
    this.message = 'The following migrations have been run, but do not exist on the filesystem:\n';
    this.message += list.map((name) => format('\t- %s', name)).join('\n');
  }
}

export class RuntimeMigrationError extends MarinerError {
  constructor(filename, error, ...args) {
    super(error.message);

    this.name = 'RuntimeMigrationError';
    this.message = `${filename}: ${error.message}`;
    this.originalError = error;
  }
}

export class InvalidMigrationError extends MarinerError {
  constructor(migrationName, ...args) {
    super(...args);

    this.name = 'InvalidMigrationError';
    this.message = 'Invalid migration file: ' + migrationName;
  }
}

export class NoDownMigrationError extends MarinerError {
  constructor(migrationName, ...args) {
    super(...args);

    this.name = 'NoDownMigrationError';
    this.message = 'Migration has no down: ' + migrationName;
  }
}

export class NoConfigError extends MarinerError {
  constructor(dialect, ...args) {
    super(...args);

    this.name = 'NoConfigError';
    this.message = 'Could not locate mariner.js file run `mariner init --help` for options';
  }
}

export class DialectMissingMethod extends MarinerError {
  constructor(dialect, method, ...args) {
    super(...args);

    this.name = 'DialectMissingMethod';
    this.message = `${dialect} must override ${method} method`;
  }
}

export class DialectUnknown extends MarinerError {
  constructor(dialect, ...args) {
    super(...args);

    this.name = 'DialectUnknown';
    this.message = `Uknown dialect ${dialect}, try npm install --save mariner-${dialect}`;
  }
}
