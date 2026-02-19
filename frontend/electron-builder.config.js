module.exports = {
  appId: 'com.strata.app',
  productName: 'Strata',
  directories: { output: 'release' },
  files: ['src/**/*', 'package.json', '.webpack/**'],
  extraResources: [{ from: '../backend/dist/strata_backend', to: 'strata_backend' }],
  mac: { target: 'dmg', icon: 'assets/icon.icns', darkModeSupport: true },
  win: { target: 'nsis', icon: 'assets/icon.ico', oneClick: true, perMachine: false },
  linux: { target: 'AppImage', icon: 'assets/icon.png' },
  nsis: { installerIcon: 'assets/icon.ico', shortcutName: 'Strata' },
};
