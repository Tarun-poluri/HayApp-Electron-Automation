/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import "./index.css";
import { createRoot } from "react-dom/client";
import { App } from "./view/App";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useListenable } from "./util/Listenable";
import { ParlayWrapper } from "./services/ParlayWrapper";

const StartupLoadingScreen: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="startup-loading-screen">
            <div className="startup-dot-ring">
                {Array.from({ length: 12 }, (_, i) => (
                    <div
                        key={i}
                        className="startup-dot"
                        style={{ transform: `rotate(${i * 30}deg)`, animationDelay: `${i * 0.1 - 1.2}s` }}
                    />
                ))}
            </div>
            <p className="startup-loading-text">{t("startup.loadingMessage")}</p>
        </div>
    );
};

const SecondaryRendererBootstrap: React.FC = () => {
    const isConnected = useListenable(ParlayWrapper.instance.isConnected);

    useEffect(() => {
        if (!ParlayWrapper.instance.isConnected.value) {
            ParlayWrapper.instance.start(false);
        }
    }, []);

    if (!isConnected) {
        return <StartupLoadingScreen />;
    }

    return <App initialNavPath={{ path: "scrWaiting" }} />;
};

const mainDiv = document.getElementById("mainDiv");
if (mainDiv) {
    createRoot(mainDiv).render(<SecondaryRendererBootstrap />);
}
