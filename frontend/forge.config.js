const path = require('path')

module.exports = {
  packagerConfig: {
    asar: true,
    extraResource: [
      path.resolve(__dirname, 'resources', 'strata_backend'),
      path.resolve(__dirname, 'resources', 'strata_backend.exe')
    ]
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'strata',
        setupExe: 'StrataSetup.exe',
        noMsi: true
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: './assets/icons/icon.png',
          categories: ['Science'],
          description: 'AI model profiling and visualization'
        }
      }
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          icon: './assets/icons/icon.png'
        }
      }
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig: './webpack.main.config.js',
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './index.html',
              js: './src/renderer.js',
              name: 'main_window',
              preload: {
                js: './src/preload.js'
              }
            }
          ]
        }
      }
    }
  ]
};
