'use strict';

import './promisify';

import PgStore from './pg-store';
import Migrate from './migrate';
import {
  MarinerError,
  MigrationsDirectoryNotFoundError,
  MigrationExistsError,
  MigrationMissingError,
  InvalidMigrationError,
  NoDownMigrationError,
  SqlMigrationError
} from './errors';

export default {
  PgStore,
  Migrate,
  MarinerError,
  MigrationsDirectoryNotFoundError,
  MigrationExistsError,
  MigrationMissingError,
  InvalidMigrationError,
  NoDownMigrationError,
  SqlMigrationError,
};
