module.exports = {
  appId: 'com.strata.app',
  productName: 'Strata',
  directories: {
    output: 'out/release',
    buildResources: 'assets'
  },
  files: [
    '.webpack/**/*',
    'package.json'
  ],
  extraResources: [
    {
      from: '../backend/dist/strata_backend',
      to: 'strata_backend'
    },
    {
      from: '../backend/dist/strata_backend.exe',
      to: 'strata_backend.exe'
    }
  ],
  linux: {
    target: [
      { target: 'deb', arch: ['x64'] },
      { target: 'AppImage', arch: ['x64'] }
    ],
    icon: 'assets/icons',
    category: 'Science',
    description: 'AI model profiling and visualization'
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'assets/icons/icon.ico'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'assets/icons/icon.ico',
    shortcutName: 'Strata',
    createDesktopShortcut: true,
    createStartMenuShortcut: true
  },
  deb: {
    artifactName: 'Strata-${version}-linux.deb',
    depends: ['libgtk-3-0', 'libnotify4', 'libnss3', 'libxss1', 'libxtst6', 'xdg-utils', 'libatspi2.0-0', 'libuuid1', 'libsecret-1-0']
  },
  appImage: {
    artifactName: 'Strata-${version}-linux.AppImage'
  }
};
