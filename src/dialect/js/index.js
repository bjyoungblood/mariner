import fs from 'fs';
import Promise from 'bluebird';
import path from 'path';

import {
  InvalidMigrationError,
  NoDownMigrationError,
} from '../../errors';

const STUB_PATH = path.join(__dirname, '/migration.stub.js');
const UP = 'up';
const DOWN = 'down';

export default class jsDialect {
  static check(ext) {
    return ext === 'js';
  };

  constructor(mariner, options, config) {
    this.mariner = mariner;
    this.options = options;
    this.config = config;
  }

  migrate(direction, name) {
    const module = require(path.join(this.config.directory, name));

    if (direction === UP && ! module.up) {
      throw new InvalidMigrationError(name);
    } else if (direction === DOWN && ! module.down) {
      throw new NoDownMigrationError(name);
    }

    return direction === UP ? module.up() : module.down();
  }

  create(dest, options) {
    return new Promise((resolve, reject) => {
      const source = fs.createReadStream(STUB_PATH);
      const out = fs.createWriteStream(dest);

      source.on('error', reject);
      out.on('error', reject);

      out.on('finish', () => resolve(dest));

      source.pipe(out);
    });
  }
}
