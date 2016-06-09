# Mariner

Seaworthy migration manager.

## Supported Migration Types
* Javascript
* SQL (through http://knexjs.org)
  - postgres
  - mysql
  - mariadb
  - sqlite3
  - oracle

## Upgrading from <0.4

`mariner init -b`

## Configuration

mariner.js (with default values)

```Javascript
module.exports = {
  directory: './migrations',

  plugins: ['sql', 'js'],

  // see list of available options at http://knexjs.org
  sql: {},

  backend: 'sql',
};
```

## Usage

### Initiate Mariner

To create the default configuration file

`mariner init`

### Migration creation

If no extension is provided mariner will use `sql`

`mariner create "name of migration" -e <file-extension>`

### Migrating

When migrating if no number is supplied on `up` all migrations are executed, on down it defaults to
the last migration

`mariner migrate up|down -n <num>`
