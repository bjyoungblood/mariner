'use strict';

import { format } from 'util';

export class MarinerError extends Error {
  constructor(message, code) {
    super(message);
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

export class SqlMigrationError extends MarinerError {
  constructor(migrationName, sqlError, ...args) {
    super(...args);

    this.name = 'SqlMigrationError';
    this.message = 'Migration ' + migrationName + ' resulted in the following error: ' + sqlError;
  }
}
