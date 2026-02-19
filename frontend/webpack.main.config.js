module.exports = {
  entry: './src/main.js',
  target: 'electron-main',
  output: {
    path: __dirname,
    filename: 'main.bundle.js',
  },
  node: {
    __dirname: false,
    __filename: false,
  },
  externals: {
    electron: 'require("electron")',
  },
};
