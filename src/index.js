'use strict'

const defaultMigrations = require('../migrations')
const repoVersion = require('./repo/version')
const repoLock = require('./repo/lock')
const isBrowser = require('./option-node')
const errors = require('./errors')
const debug = require('debug')

const log = debug('js-ipfs-repo-migrations:migrator')

exports.getCurrentRepoVersion = repoVersion.getVersion

/**
 * Returns the version of latest migration.
 *
 * @returns {int}
 */
function getLatestMigrationVersion (migrations) {
  migrations = migrations || defaultMigrations

  if (!Array.isArray(migrations) || migrations.length === 0) {
    throw Error('Migrations must be non-empty array!')
  }

  return migrations[migrations.length - 1].version
}

exports.getLatestMigrationVersion = getLatestMigrationVersion

/**
 * Main function to execute forward migrations.
 * It acquire lock on the provided path before doing any migrations.
 *
 * Signature of the progress callback is: function(migrationObject: object, currentMigrationNumber: int, totalMigrationsCount: int)
 *
 * @param {string} path - Path to initialized (!) JS-IPFS repo
 * @param {int?} toVersion - Version to which the repo should be migrated, if undefined repo will be migrated to the latest version.
 * @param {function?} progressCb - Callback which will be called after each executed migration to report progress
 * @param {boolean?} isDryRun - Allows to simulate the execution of the migrations without any effect.
 * @param {array?} migrations - Array of migrations to migrate. If undefined, the bundled migrations are used. Mainly for testing purpose.
 * @returns {Promise<void>}
 */
async function migrate (path, toVersion, progressCb, isDryRun, migrations) {
  migrations = migrations || defaultMigrations

  if (!path) {
    throw new Error('Path argument is required!')
  }

  if (toVersion && (!Number.isInteger(toVersion) || toVersion <= 0)) {
    throw new Error('Version has to be positive integer!')
  }
  toVersion = toVersion || getLatestMigrationVersion(migrations)

  const currentVersion = await repoVersion.getVersion(path)

  if (currentVersion === toVersion) {
    log('Nothing to migrate, skipping migrations.')
    return
  }

  if (currentVersion > toVersion) {
    log(`Current repo's version (${currentVersion} is higher then toVersion (${toVersion}), nothing to migrate.`)
    return
  }

  let lock
  if (!isDryRun) lock = await repoLock.lock(currentVersion, path)

  try {
    let counter = 0
    let totalMigrations = toVersion - currentVersion
    for (let migration of migrations) {
      if (toVersion !== undefined && migration.version > toVersion) {
        break
      }

      if (migration.version > currentVersion) {
        counter++
        log(`Migrating version ${migration.version}`)
        if (!isDryRun) {
          try {
            await migration.migrate(path, isBrowser)
          } catch (e) {
            e.message = `During migration to version ${migration.version} exception was raised: ${e.message}`
            throw e
          }
        }
        typeof progressCb === 'function' && progressCb(migration, counter, totalMigrations) // Reports on migration process
        log(`Migrating to version ${migration.version} finished`)
      }
    }

    if (!isDryRun) await repoVersion.setVersion(path, toVersion || getLatestMigrationVersion(migrations))
    log('All migrations successfully migrated ', toVersion !== undefined ? `to version ${toVersion}!` : 'to latest version!')
  } finally {
    if (!isDryRun) await lock.close()
  }
}

exports.migrate = migrate

/**
 * Main function to execute backward migration (reversion).
 * It acquire lock on the provided path before doing any migrations.
 *
 * Signature of the progress callback is: function(migrationObject: object, currentMigrationNumber: int, totalMigrationsCount: int)
 *
 * @param {string} path - Path to initialized (!) JS-IPFS repo
 * @param {int} toVersion - Version to which the repo will be reverted.
 * @param {function?} progressCb - Callback which will be called after each reverted migration to report progress
 * @param {boolean?} isDryRun - Allows to simulate the execution of the reversion without any effects. Make sense to utilize progressCb with this argument.
 * @param {array?} migrations - Array of migrations to migrate. If undefined, the bundled migrations are used. Mainly for testing purpose.
 * @returns {Promise<void>}
 */
async function revert (path, toVersion, progressCb, isDryRun, migrations) {
  migrations = migrations || defaultMigrations

  if (!path) {
    throw new Error('Path argument is required!')
  }

  if (!toVersion) {
    throw new Error('When reverting migrations, you have to specify to which version to revert!')
  }

  if (!Number.isInteger(toVersion) || toVersion <= 0) {
    throw new Error('Version has to be positive integer!')
  }

  const currentVersion = await repoVersion.getVersion(path)
  if (currentVersion === toVersion) {
    log('Nothing to revert, skipping reverting.')
    return
  }

  if (currentVersion < toVersion){
    log(`Current repo's version (${currentVersion} is lower then toVersion (${toVersion}), nothing to revert.`)
    return
  }

  let reversibility = verifyReversibility(migrations, currentVersion, toVersion)
  if (!reversibility.reversible) {
    throw new errors.NonReversibleMigration(`Migration version ${reversibility.version} is not possible to revert! Cancelling reversion.`)
  }

  let lock
  if (!isDryRun) lock = await repoLock.lock(currentVersion, path)

  log(`Reverting from version ${currentVersion} to ${toVersion}`)
  try {
    let counter = 0
    let totalMigrations = currentVersion - toVersion
    const reversedMigrationArray = migrations.slice().reverse()
    for (let migration of reversedMigrationArray) {
      if (migration.version <= toVersion) {
        break
      }

      if (migration.version <= currentVersion) {
        counter++
        log(`Reverting migration version ${migration.version}`)
        if (!isDryRun) {
          try {
            await migration.revert(path, isBrowser)
          } catch (e) {
            e.message = `During reversion to version ${migration.version} exception was raised: ${e.message}`
            throw e
          }
        }
        typeof progressCb === 'function' && progressCb(migration, counter, totalMigrations) // Reports on migration process
        log(`Reverting to version ${migration.version} finished`)
      }
    }

    if (!isDryRun) await repoVersion.setVersion(path, toVersion)
    log(`All migrations successfully reverted to version ${toVersion}!`)
  } finally {
    if (!isDryRun) await lock.close()
  }
}

exports.revert = revert

/**
 * Function checks if all migrations in given range supports reversion.
 *
 * @param {array} migrations
 * @param {int} fromVersion
 * @param {int} toVersion
 * @returns {object}
 */
function verifyReversibility (migrations, fromVersion, toVersion) {
  for (let migration of migrations) {
    if (migration.version > fromVersion) {
      break
    }

    if (migration.version >= toVersion && !migration.reversible) {
      return { reversible: false, version: migration.version }
    }
  }

  return { reversible: true, version: undefined }
}
