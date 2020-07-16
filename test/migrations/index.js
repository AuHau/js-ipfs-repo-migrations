/* eslint-env mocha */
'use strict'

const CONFIGURATIONS = [{
  name: 'with sharding',
  options: {
    storageBackendOptions: {
      root: {
        sharding: true,
        extension: '.data'
      },
      blocks: {
        sharding: true,
        extension: '.data'
      },
      datastore: {
        sharding: true,
        extension: '.data'
      },
      keys: {
        sharding: true,
        extension: '.data'
      },
      pinstore: {
        sharding: true,
        extension: '.data'
      }
    }
  }
}, {
  name: 'without sharding',
  options: {
    storageBackendOptions: {
      root: {
        sharding: false,
        extension: '.data'
      },
      blocks: {
        sharding: false,
        extension: '.data'
      },
      datastore: {
        sharding: false,
        extension: '.data'
      },
      keys: {
        sharding: false,
        extension: '.data'
      },
      pinstore: {
        sharding: false,
        extension: '.data'
      }
    }
  }
}]

module.exports = (createRepo, repoCleanup) => {
  CONFIGURATIONS.forEach(({ name, options }) => {
    describe(name, () => {
      require('./migration-8-test')(createRepo, repoCleanup, options)
      require('./migration-9-test')(createRepo, repoCleanup, options)
    })
  })
}
