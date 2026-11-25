# Caveria Desktop

Caveria can run in a dedicated Electron window while continuing to support the browser build.

## Run the desktop app

On Windows, double-click `run-desktop.cmd`. On macOS or Linux, run:

```bash
./run-desktop.sh
```

The launcher installs missing locked dependencies, builds the game, and opens the desktop window. Press **F11** to toggle fullscreen.

The equivalent npm command is:

```bash
npm run desktop
```

## Run with F5 in VS Code

After the one-time dependency setup, open the repository folder in VS Code and press **F5**. The default `Play Caveria (Desktop)` launch profile builds the current source and opens it directly in Electron. It does not reinstall dependencies or create an installer.

Use the Run and Debug dropdown if you want to select the optional Chrome or Edge profiles instead.

## Build a Windows installer

On Windows, run:

```bash
npm run desktop:build
```

The generated NSIS installer is written to `release/Caveria-Setup-<version>.exe`. The first packaging run may download Electron packaging tools. Because the installer is not code-signed, Windows SmartScreen may show an unrecognized-publisher warning.

## Save data

The desktop app uses the same browser-compatible local save system, stored inside Electron's application data directory. Desktop saves are separate from saves made in a normal browser.

## Security

The game renderer runs with Node.js integration disabled, context isolation enabled, and Chromium sandboxing enabled. External links are opened in the system browser.
