# Migration tool for JS IPFS Repo

[![](https://img.shields.io/badge/made%20by-Protocol%20Labs-blue.svg?style=flat-square)](http://ipn.io)
[![](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](http://ipfs.io/)
[![](https://img.shields.io/badge/freenode-%23ipfs-blue.svg?style=flat-square)](http://webchat.freenode.net/?channels=%23ipfs)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/feross/standard)
![](https://img.shields.io/badge/npm-%3E%3D3.0.0-orange.svg?style=flat-square)
![](https://img.shields.io/badge/Node.js-%3E%3D10.0.0-orange.svg?style=flat-square)

> Migration framework for versioning of JS IPFS Repo

This package is inspired by the [go-ipfs repo migration tool](https://github.com/ipfs/fs-repo-migrations/)

## Lead Maintainer

???

## Table of Contents

- [Background](#background)
- [Install](#install)
  - [npm](#npm)
  - [Use in Node.js](#use-in-nodejs)
  - [Use in a browser with browserify, webpack or any other bundler](#use-in-a-browser-with-browserify-webpack-or-any-other-bundler)
  - [Use in a browser Using a script tag](#use-in-a-browser-using-a-script-tag)
- [Usage](#usage)
  - [Writing migration](#writing-migration)
  - [Migrations matrix](#migrations-matrix)
- [API](#api)
- [CLI](#cli)
- [Contribute](#contribute)
- [License](#license)

## Background


As js-ipfs evolves and new technologies, algorithms and data structures are incorporated it is necessary to 
enable users to transition between versions. Different versions of js-ipfs may expect a different IPFS repo structure or content (see: [IPFS repo spec](https://github.com/ipfs/specs/tree/master/repo), [JS implementation](https://github.com/ipfs/js-ipfs-repo) ).
So the IPFS repo is versioned, and this package provides a framework to create migrations to transition
from one version of IPFS repo to the next/previous version.

This framework:
 * Handles locking/unlocking of repository
 * Defines migrations API
 * Executes and reports migrations in both directions: forward and backward
 * Simplifies creation of new migrations

## Install

### npm

```sh
> npm install ipfs-repo-migrations
```

### Use in Node.js

```js
const migrations = require('ipfs-repo-migrations')
```

### Use in a browser with browserify, webpack or any other bundler

```js
const migrations = require('ipfs-repo-migrations')
```

## Usage

Example:

```js
const migrations = require('ipfs-repo-migrations')
const getVersion = require('ipfs-repo-migrations/repo/version')

const repoPath = 'some/repo/path'
const repoVersion = await getVersion(repoPath)

if(repoVersion < migrations.getLatestMigrationVersion()){
  // Old repo! Lets migrate to latest version!
  await migrations.migrate(repoPath)
}
```

To migrate your repository using the CLI, see the [how to run migrations](./run.md) tutorial. 

**For tools that build on top of `js-ipfs` and run mainly in the browser environment, be aware that disabling automatic
migrations leaves the user with no way to run the migrations because there is no CLI in the browser. In such
a case, you should provide a way to trigger migrations manually.**

### Writing migration

Migrations are one of those things that can be extremely painful on users. At the end of the day, we want users never to have to think about it. The process should be:

- SAFE. No data lost. Ever.
- Revertible. Tools must implement forward and backward (if possible) migrations.
- Tests. Migrations have to be well tested.
- To Spec. The tools must conform to the spec.

#### Architecture of migrations

All migrations are placed in the `/migrations` folder. Each folder there represents one migration that follows the migration
API.

All migrations are collected in `/migrations/index.js`, which should not be edited manually. It is regenerated on
every run of `jsipfs-migrations add` (manual changes should follow the same style of modifications). 
**The order of migrations is important and migrations must be sorted in ascending order**.

Each migration must follow this API. It must export an object in its `index.js` that has following properties:

 * `version` (int) - Number that represents the version which the repo will migrate to (eg. `migration-8` will move the repo to version 8).
 * `description` (string) - Brief description of what the migrations does.
 * `migrate` (function) - Function that performs the migration (see signature of this function below)
 * `revert` (function) - If defined then this function will revert the migration to the previous version. Otherwise it is assumed that it is not possible to revert this migration.

##### `migrate(repoPath, isBrowser)`

_Do not confuse this function with the `require('ipfs-repo-migrations').migrate()` function that drives the whole migration process!_

Arguments:
 * `repoPath` (string) - absolute path to the root of the repo
 * `options` (object, optional) - object containing `IPFSRepo` options, that should be used to construct a datastore instance.
 * `isBrowser` (bool) - indicates if the migration is run in a browser environment (as opposed to NodeJS)
 
##### `revert(repoPath, isBrowser)`

_Do not confuse this function with the `require('ipfs-repo-migrations').revert()` function that drives the whole backward migration process!_

Arguments:
 * `repoPath` (string) - path to the root of the repo
 * `options` (object, optional) - object containing `IPFSRepo` options, that should be used to construct the datastore instance.
 * `isBrowser` (bool) - indicates if the migration is run in a browser environment (as opposed to NodeJS)

#### Browser vs. NodeJS environments

The migration might need to distinguish in which environment it runs (browser vs. NodeJS). For this reason there is an argument
`isBrowser` passed to migrations functions. But with simple migrations it should not be necessary to distinguish between
these environments as the datastore implementation will handle the main differences. 

There are currently two main datastore implementations:
 1. [`datastore-fs`](https://github.com/ipfs/js-datastore-fs) that is backed by file system and is used mainly in the NodeJS environment
 2. [`datastore-level`](https://github.com/ipfs/js-datastore-level) that is backed by LevelDB and is used mainly in the browser environment
 
 Both implementations share the same API and hence are interchangeable. 

 When the migration is run in a browser environment, `datastore-fs` is automatically replaced with `datastore-level` even 
 when it is directly imported (`require('datastore-fs')` will return `datastore-level` in a browser). 
 So with simple migrations you shouldn't worry about the difference between `datastore-fs` and `datastore-level` 
 and by default use the `datastore-fs` package (as the replace mechanism does not work vice versa).

#### Guidelines

The recommended way to write a new migration is to first bootstrap a dummy migration using the CLI:

```sh
> jsipfs-migrations add
```

A new folder is created with the bootstrapped migration. You can then simply fill in the required fields and 
write the rest of the migration! 

#### Migration's dependencies

The size of the `js-ipfs` bundle is crucial for distribution in a browser environment, so dependency management of all related
packages is important.

If a migration needs to depend on some package, this dependency should be declared in the root's `package.json`. The author
of the migration should be thoughtful about adding dependencies that would significantly increase the size of the final bundle.

Most of the migration's dependencies will most likely overlap with `js-ipfs`'s dependencies and hence should not introduce
any significant overhead, but it is necessary to keep the versions of these dependencies in sync with `js-ipfs`. For this 
reason migrations should be well tested to ensure correct behaviour over dependency updates.
An update of some dependency could introduce breaking change. In such a case the next steps should be discussed with a broader 
audience. 

#### Integration with js-ipfs

When a new migration is created, the repo version in [`js-ipfs-repo`](https://github.com/ipfs/js-ipfs-repo) should be updated with the new version,
together with updated version of this package. Then the updated version should be propagated to `js-ipfs`.

#### Tests

If a migration affects any of the following functionality, it must provide tests for the following functions
 to work under the version of the repo that it migrates to:

* `/src/repo/version.js`:`getVersion()` - retrieving repository's version
* `/src/repo/lock.js`:`lock()` - locking repository that uses file system
* `/src/repo/lock-memory.js`:`lock()` - locking repository that uses memory

Every migration must have test coverage. Tests for migrations should be placed in the `/test/migrations/` folder. Most probably
you will have to plug the tests into `browser.js`/`node.js` if they require specific bootstrapping on each platform.

#### Empty migrations

For interop with go-ipfs it might be necessary just to bump a version of a repo without any actual 
modification as there might not be any changes needed in the JS implementation. For that purpose you can create an "empty migration".

The easiest way to do so is with the CLI:

```sh
> jsipfs-migrations add --empty
```

This will create an empty migration with the next version.

### Migrations matrix

| IPFS repo version  | JS IPFS version  |
| -----------------: |:----------------:|
|                  7 | v0.0.0 - latest  |


## API

### `migrate(path, {toVersion, ignoreLock, repoOptions, onProgress, isDryRun}) -> Promise<void>`

Executes a forward migration to a specific version, or to the latest version if a specific version is not specified.

**Arguments:**

 * `path` (string, mandatory) - path to the repo to be migrated
 * `options` (object, optional) - options for the migration
 * `options.toVersion` (int, optional) - version to which the repo should be migrated. Defaults to the latest migration version.
 * `options.ignoreLock` (bool, optional) - if true will not lock the repo when applying migrations. Use with caution.
 * `options.repoOptions` (object, optional) - options that are passed to migrations, that use them to construct the datastore. (options are the same as for IPFSRepo).
 * `options.onProgress` (function, optional) - callback that is called after finishing execution of each migration to report progress.
 * `options.isDryRun` (bool, optional) - flag that indicates if it is a dry run that should give the same output as running a migration but without making any actual changes.
 
#### `onProgress(migration, counter, totalMigrations)`
 
Signature of the progress callback.

**Arguments:**
 * `migration` (object) - object of migration that just successfully finished running. See [Architecture of migrations](#architecture-of-migrations) for details.
 * `counter` (int) - index of current migration.
 * `totalMigrations` (int) - total count of migrations that will be run.

### `revert(path, toVersion, {ignoreLock, options, onProgress, isDryRun}) -> Promise<void>`

Executes backward migration to a specific version.

**Arguments:**

 * `path` (string, mandatory) - path to the repo to be reverted
 * `toVersion` (int, mandatory) - version to which the repo should be reverted to. 
 * `options` (object, optional) - options for the reversion
 * `options.ignoreLock` (bool, optional) - if true will not lock the repo when applying migrations. Use with caution.
 * `options.options` (object, optional) - options that are passed to migrations, that use them to construct the datastore. (options are the same as for IPFSRepo).
 * `options.onProgress` (function, optional) - callback that is called after finishing execution of each migration to report progress.
 * `options.isDryRun` (bool, optional) - flag that indicates if it is a dry run that should give the same output as running a migration but without making any actual changes.
 
### `getLatestMigrationVersion() -> int`

Return the version of the latest migration.

## CLI

The CLI is a NodeJS binary named `jsipfs-repo-migrations`. 
It has several commands:

 * `migrate` - performs forward/backward migration to specific or latest version.
 * `status` - check repo for migrations that should be run.
 * `add` - bootstraps new migration.
 
For further details see the `--help` pages.

## Contribute

There are some ways you can make this module better:

- Consult our [open issues](https://github.com/ipfs/js-ipfs-repo/issues) and take on one of them
- Help our tests reach 100% coverage!

This repository falls under the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/contributing.md)

## License

[MIT](LICENSE)
