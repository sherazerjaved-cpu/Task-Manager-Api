const config = {
  mongodb: {
    url: 'mongodb://localhost:27017/task-manager?replicaSet=rs0&directConnection=true',
    databaseName: 'task-manager',
  },

  migrationsDir: 'migrations',
  changelogCollectionName: 'changelog',
  migrationFileExtension: '.js',
  moduleSystem: 'commonjs',
};

module.exports = config;