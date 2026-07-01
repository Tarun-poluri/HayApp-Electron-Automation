import { app, BrowserWindow, ipcMain, screen, dialog } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import fs from "fs";
import { ChildProcess, spawn, spawnSync } from "node:child_process";
import { updateElectronApp, UpdateSourceType } from "update-electron-app";
import { autoUpdater } from "electron";

const OPEN_DEVTOOLS = process.env.OPEN_DEVTOOLS === "true";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
    app.quit();
}

let mainWindow: BrowserWindow;
let secondWindow: BrowserWindow;

const createWindow = () => {
    const displays = screen.getAllDisplays();
    const primaryDisplay = displays[0];
    const preload = path.join(__dirname, "preload.js");
    console.log("reading preload at " + preload);

    mainWindow = new BrowserWindow({
        x: primaryDisplay.bounds.x,
        y: primaryDisplay.bounds.y,
        width: primaryDisplay.bounds.width,
        height: primaryDisplay.bounds.height,
        show: false,
        fullscreen: true,
        backgroundColor: "#000000",
        webPreferences: {
            preload: preload,
        },
    });

    // and load the index.html of the app.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
        mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }

    // Open the DevTools.
    if (OPEN_DEVTOOLS) {
        mainWindow.webContents.openDevTools({ mode: "undocked" });
    }

    mainWindow.once("ready-to-show", () => {
        mainWindow.setFullScreen(true);
        mainWindow.show();
    });
};

const createSecondWindow = () => {
    const displays = screen.getAllDisplays();
    // Use the second display if available, otherwise fallback to primary
    const secondDisplay = displays[1] || displays[0];
    const preload = path.join(__dirname, "preload.js");

    secondWindow = new BrowserWindow({
        x: secondDisplay.bounds.x,
        y: secondDisplay.bounds.y,
        width: secondDisplay.bounds.width,
        height: secondDisplay.bounds.height,
        show: false,
        fullscreen: true,
        backgroundColor: "#000000",
        webPreferences: {
            preload: preload,
        },
    });

    // Load the same content as the main window
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        const path = MAIN_WINDOW_VITE_DEV_SERVER_URL + "/index-secondary.html";
        console.log("opening secondary window " + path);
        secondWindow.loadURL(path);
    } else {
        secondWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index-secondary.html`));
    }

    // Open the DevTools.
    if (OPEN_DEVTOOLS) {
        secondWindow.webContents.openDevTools({ mode: "undocked" });
    }

    secondWindow.once("ready-to-show", () => {
        secondWindow.setFullScreen(true);
        secondWindow.show();
    });
};

ipcMain.handle("readFile", async (evt, fileName): Promise<string> => {
    console.log("read file " + fileName + " called from " + __dirname);
    // Use app.getAppPath() so reading files works both in dev and packaged builds.
    // In packaged apps files are typically inside the app.asar or resources path.
    const src = path.join(app.getAppPath(), fileName as string);
    return new Promise<string>((resolve, reject) => {
        fs.readFile(src, { encoding: "utf8" }, (err, data) => {
            if (err) {
                console.log("read file failed with " + JSON.stringify(err));
                reject(err);
                return;
            }

            console.log("read " + data.length + " bytes from " + fileName);
            resolve(data);
        });
    });
});

ipcMain.on("requestVerification", (event, data) => {
    console.log("request verification called with " + JSON.stringify(data));

    secondWindow.webContents.send("requestVerification", data);
});

ipcMain.on("countVerified", (_event, data) => {
    console.log("count verified called with " + JSON.stringify(data));
    //mainWindow.webContents.send("countVerified", data, verified);
    secondWindow.webContents.send("countVerified", data);
});

ipcMain.on("requestFinalVerification", () => {
    console.log("final count verification called");
    secondWindow.webContents.send("requestFinalVerification");
});

ipcMain.on("finalCountVerified", () => {
    console.log("final count verified called");
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
    if (app.isPackaged) {
        const logPath = path.join(app.getPath("userData"), "update-events.log");
        const logUpdate = (msg: string) => {
            const line = `[${new Date().toISOString()}] ${msg}\n`;
            fs.appendFileSync(logPath, line);
        };

        logUpdate(`App started — version ${app.getVersion()}`);

        autoUpdater.on("checking-for-update", () => logUpdate("Checking for update..."));
        autoUpdater.on("update-available", () => logUpdate("Update available — downloading..."));
        autoUpdater.on("update-not-available", () => logUpdate("No update available"));
        autoUpdater.on("error", (err) => {
            logUpdate(`ERROR: ${err.message}`);
        });

        autoUpdater.on("update-downloaded", () => {
            logUpdate("Update downloaded — showing restart dialog");
            // Exit fullscreen so the dialog is visible (app runs fullscreen on both displays)
            if (mainWindow) mainWindow.setFullScreen(false);
            if (secondWindow) secondWindow.setFullScreen(false);

            dialog.showMessageBox({
                type: "info",
                buttons: ["Restart Now", "Later"],
                defaultId: 0,
                title: "Update Ready",
                message: "A new version of HayApp has been downloaded.",
                detail: "Restart the application to apply the update.",
            }).then((result) => {
                if (result.response === 0) {
                    logUpdate("User chose Restart — applying update");
                    autoUpdater.quitAndInstall();
                } else {
                    logUpdate("User chose Later — restoring fullscreen");
                    if (mainWindow) mainWindow.setFullScreen(true);
                    if (secondWindow) secondWindow.setFullScreen(true);
                }
            });
        });

        updateElectronApp({
            updateSource: {
                type: UpdateSourceType.ElectronPublicUpdateService,
                repo: "Tarun-poluri/HayApp-Releases",
            },
            updateInterval: "5 minutes",
            notifyUser: false,
        });
    }
    createWindow();
    createSecondWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

type BackendLaunchConfig = {
    command: string;
    args: string[];
    cwd: string;
};

let backendProcess: ChildProcess | null = null;
let backendStopping = false;

function resolveBackendLaunchConfig(): BackendLaunchConfig {
    if (app.isPackaged) {
        // extraResource places broker/ inside resources/ directory
        const backendDir = path.join(process.resourcesPath, "broker");
        return {
            command: path.join(backendDir, "HayAppBroker.exe"),
            args: [],
            cwd: backendDir,
        };
    }

    const backendDir = path.resolve(process.cwd(), "..", "hayapp_backend");
    return {
        command: path.join(backendDir, "venv", "Scripts", "python3.11.exe"),
        args: ["-m", "hayapp_python.hayapp_broker"],
        cwd: backendDir,
    };
}

function forceKillBackend(pid: number) {
    if (process.platform === "win32") {
        spawnSync("taskkill", ["/PID", pid.toString(), "/T", "/F"], { stdio: "ignore" });
        return;
    }

    process.kill(pid, "SIGKILL");
}

async function stopBackendProcess(reason: string): Promise<void> {
    if (!backendProcess || backendStopping) {
        return;
    }

    backendStopping = true;
    const child = backendProcess;
    const pid = child.pid;
    console.log(`Stopping backend. reason=${reason}, pid=${pid}`);

    await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
            if (pid) {
                forceKillBackend(pid);
            }
            resolve();
        }, 4000);

        child.once("exit", () => {
            clearTimeout(timeout);
            resolve();
        });

        child.kill("SIGTERM");
    });

    backendProcess = null;
    backendStopping = false;
}

function startBackendProcess() {
    if (backendProcess) {
        return;
    }

    const brokerLogPath = path.join(app.getPath("userData"), "broker-startup.log");
    const logBroker = (msg: string) => {
        const line = `[${new Date().toISOString()}] ${msg}\n`;
        try { fs.appendFileSync(brokerLogPath, line); } catch (_) { /* ignore */ }
    };

    const launchConfig = resolveBackendLaunchConfig();
    const fullCommandPath = path.resolve(launchConfig.command);
    const fullCwdPath = path.resolve(launchConfig.cwd);

    logBroker(`execPath: ${process.execPath}`);
    logBroker(`brokerDir: ${fullCwdPath}`);
    logBroker(`brokerExe: ${fullCommandPath}`);
    logBroker(`cwdExists: ${fs.existsSync(fullCwdPath)}`);
    logBroker(`exeExists: ${fs.existsSync(fullCommandPath)}`);

    if (!fs.existsSync(fullCwdPath)) {
        logBroker("ERROR: broker folder not found — backend will not start");
        return;
    }

    if (!fs.existsSync(fullCommandPath)) {
        logBroker("ERROR: HayAppBroker.exe not found — backend will not start");
        return;
    }

    logBroker(`Starting backend from ${fullCommandPath}`);
    backendProcess = spawn(fullCommandPath, launchConfig.args, {
        cwd: fullCwdPath,
        stdio: "inherit",
        windowsHide: true,
        shell: false,
    });

    backendProcess.on("exit", (code, signal) => {
        const brokerLogPath = path.join(app.getPath("userData"), "broker-startup.log");
        try { fs.appendFileSync(brokerLogPath, `[${new Date().toISOString()}] Backend exited code=${code} signal=${signal}\n`); } catch (_) { /* ignore */ }
        backendProcess = null;
    });

    backendProcess.on("error", (error) => {
        const brokerLogPath = path.join(app.getPath("userData"), "broker-startup.log");
        try { fs.appendFileSync(brokerLogPath, `[${new Date().toISOString()}] Backend error: ${error.message}\n`); } catch (_) { /* ignore */ }
    });
}

app.on("before-quit", (event) => {
    if (!backendProcess || backendStopping) {
        return;
    }

    event.preventDefault();
    void stopBackendProcess("app-before-quit").finally(() => app.quit());
});

process.on("SIGINT", () => {
    void stopBackendProcess("process-sigint").finally(() => app.exit(0));
});

process.on("SIGTERM", () => {
    void stopBackendProcess("process-sigterm").finally(() => app.exit(0));
});

process.on("exit", () => {
    if (backendProcess?.pid) {
        forceKillBackend(backendProcess.pid);
    }
});

if (!started) {
    startBackendProcess();
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.





