# Icons

Place the following files here for packaging:

- **icon.png** (512×512)
- **icon.ico** (Windows — convert from icon.png)
- **icon.icns** (macOS — convert from icon.png, skip for now)

Generate from `icon.svg` using:

- ImageMagick: `convert icon.svg -resize 512x512 icon.png`
- Then: `convert icon.png -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico`

If the build fails with missing icon errors (e.g. Squirrel/Forge "icon not found"), create the files using the commands above or an online converter (e.g. convertio.co).
