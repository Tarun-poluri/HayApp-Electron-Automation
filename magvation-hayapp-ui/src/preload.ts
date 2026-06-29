// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { CaseSuture } from "./services/CaseService";

/* eslint-disable-next-line */
const { contextBridge, ipcRenderer } = require("electron");

export interface RequestVerificationArg {
    caseSuture: CaseSuture;
    reason: string;
}
type RequestVerificationCB = (arg: RequestVerificationArg) => void;

export interface CountVerifiedArg {
    caseSuture: CaseSuture;
    verified: boolean;
}
type CountVerifiedCB = (arg: CountVerifiedArg) => void;

type RequestFinalVerificationCB = () => void;
type FinalCountVerifiedCB = (verified: boolean) => void;

contextBridge.exposeInMainWorld("electronAPI", {
    readFile: (path: string) => ipcRenderer.invoke("readFile", path),
    requestVerification: (arg: RequestVerificationArg) => {
        console.log("verification requested");
        ipcRenderer.postMessage("requestVerification", arg);
    },
    addRequestVerificationListener: (listener: RequestVerificationCB) => {
        console.log("request verification listener added");
        ipcRenderer.on("requestVerification", listener);
    },
    countVerified: (arg: CountVerifiedArg) => {
        console.log("verification responded");
        ipcRenderer.postMessage("countVerified", arg);
    },
    addCountVerifiedListener: (listener: CountVerifiedCB) => {
        console.log("count verified listener added");
        ipcRenderer.on("countVerified", listener);
    },
    requestFinalVerification: () => {
        console.log("final verification requested");
        ipcRenderer.postMessage("requestFinalVerification");
    },
    addRequestFinalVerificationListener: (listener: RequestFinalVerificationCB) => {
        console.log("request final verification listener added");
        ipcRenderer.on("requestFinalVerification", listener);
    },
    finalCountVerified: (arg: boolean) => {
        console.log("final count verification responded");
        ipcRenderer.postMessage("finalCountVerified", arg);
    },
    addFinalCountVerifiedListener: (listener: FinalCountVerifiedCB) => {
        console.log("final count verification listener added");
        ipcRenderer.on("finalCountVerified", listener);
    },
});
