module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },
  moduleFileExtensions: ['js', 'jsx'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js']
};
