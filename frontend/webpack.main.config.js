module.exports = {
  entry: './src/main.js',
  target: 'electron-main',
  node: {
    __dirname: false,
    __filename: false,
  },
  externals: ['electron'],
};
