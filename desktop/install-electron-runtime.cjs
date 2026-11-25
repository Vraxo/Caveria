const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { downloadArtifact } = require('@electron/get');
const extract = require('extract-zip');

const electronRoot = path.dirname(require.resolve('electron/package.json'));
const electronPackage = require(path.join(electronRoot, 'package.json'));
const checksums = require(path.join(electronRoot, 'checksums.json'));
const distPath = path.join(electronRoot, 'dist');

function executablePathFor(platform) {
  switch (platform) {
    case 'win32': return 'electron.exe';
    case 'darwin': return 'Electron.app/Contents/MacOS/Electron';
    case 'linux':
    case 'freebsd':
    case 'openbsd': return 'electron';
    default: throw new Error(`Electron does not publish a runtime for ${platform}.`);
  }
}

async function install() {
  const platform = os.platform();
  const arch = os.arch();
  const executablePath = executablePathFor(platform);

  // This repair command exists specifically for installations where npm skipped
  // Electron's postinstall, so do not inherit its opt-out switch.
  delete process.env.ELECTRON_SKIP_BINARY_DOWNLOAD;

  console.log(`[Caveria] Downloading Electron ${electronPackage.version} for ${platform}-${arch}...`);
  const archive = await downloadArtifact({
    version: electronPackage.version,
    artifactName: 'electron',
    platform,
    arch,
    checksums,
  });

  fs.rmSync(distPath, { recursive: true, force: true });
  fs.mkdirSync(distPath, { recursive: true });
  console.log('[Caveria] Extracting Electron runtime...');
  await extract(archive, { dir: distPath });
  fs.writeFileSync(path.join(electronRoot, 'path.txt'), executablePath);

  const installedExecutable = path.join(distPath, executablePath);
  if (!fs.existsSync(installedExecutable)) {
    throw new Error(`Archive extraction completed but ${installedExecutable} is missing.`);
  }
  console.log(`[Caveria] Electron runtime ready: ${installedExecutable}`);
}

install().catch((error) => {
  console.error('[Caveria] Electron runtime installation failed.');
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
