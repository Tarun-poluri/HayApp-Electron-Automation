import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { SurgeonWithCaseGroups } from "../view/subview/SurgeonsView";

export type SurgeonFlowMode = "add" | "change" | "view";

type FlowCompleteCallback = (
    mode: SurgeonFlowMode,
    newSurgeon: SurgeonWithCaseGroups | null,
    targetIndex: number | null,
    updatedSurgeons?: SurgeonWithCaseGroups[],
) => void;

interface SurgeonsViewContextType {
    // Unified surgeon flow (add, change, or view)
    surgeonFlowActive: boolean;
    surgeonFlowMode: SurgeonFlowMode | null;
    flowSurgeons: SurgeonWithCaseGroups[];
    flowTargetIndex: number | null;
    startSurgeonFlow: (mode: SurgeonFlowMode, surgeons: SurgeonWithCaseGroups[], targetIndex?: number) => void;
    endSurgeonFlow: (newSurgeon?: SurgeonWithCaseGroups, updatedSurgeons?: SurgeonWithCaseGroups[]) => void;
    showSurgeonsView: () => void; // Convenience: starts "view" mode with empty list (fetches from backend)
    setOnFlowComplete: (callback: FlowCompleteCallback | null) => void;
    // Toast notification
    toastMessage: string | null;
    toastIcon: string | null;
    showToast: (message: string, icon?: string) => void;
    clearToast: () => void;
}

const SurgeonsViewContext = createContext<SurgeonsViewContextType | undefined>(undefined);

export const SurgeonsViewProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [surgeonFlowActive, setSurgeonFlowActive] = useState(false);
    const [surgeonFlowMode, setSurgeonFlowMode] = useState<SurgeonFlowMode | null>(null);
    const [flowSurgeons, setFlowSurgeons] = useState<SurgeonWithCaseGroups[]>([]);
    const [flowTargetIndex, setFlowTargetIndex] = useState<number | null>(null);
    const [onFlowComplete, setOnFlowComplete] = useState<FlowCompleteCallback | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [toastIcon, setToastIcon] = useState<string | null>(null);

    const startSurgeonFlow = useCallback(
        (mode: SurgeonFlowMode, surgeons: SurgeonWithCaseGroups[], targetIndex?: number) => {
            setSurgeonFlowMode(mode);
            setFlowSurgeons(surgeons);
            setFlowTargetIndex(targetIndex ?? null);
            setSurgeonFlowActive(true);
        },
        [],
    );

    const endSurgeonFlow = useCallback(
        (newSurgeon?: SurgeonWithCaseGroups, updatedSurgeons?: SurgeonWithCaseGroups[]) => {
            if (onFlowComplete && surgeonFlowMode) {
                onFlowComplete(surgeonFlowMode, newSurgeon ?? null, flowTargetIndex, updatedSurgeons);
            }

            setSurgeonFlowActive(false);
            setSurgeonFlowMode(null);
            setFlowSurgeons([]);
            setFlowTargetIndex(null);
        },
        [onFlowComplete, surgeonFlowMode, flowTargetIndex],
    );

    const showSurgeonsView = useCallback(() => {
        startSurgeonFlow("view", []);
    }, [startSurgeonFlow]);

    const setFlowCompleteCallback = useCallback((callback: FlowCompleteCallback | null) => {
        setOnFlowComplete(() => callback);
    }, []);

    const showToast = useCallback((message: string, icon?: string) => {
        setToastMessage(message);
        setToastIcon(icon ?? null);
    }, []);

    const clearToast = useCallback(() => {
        setToastMessage(null);
        setToastIcon(null);
    }, []);

    return (
        <SurgeonsViewContext.Provider
            value={{
                surgeonFlowActive,
                surgeonFlowMode,
                flowSurgeons,
                flowTargetIndex,
                startSurgeonFlow,
                endSurgeonFlow,
                showSurgeonsView,
                setOnFlowComplete: setFlowCompleteCallback,
                toastMessage,
                toastIcon,
                showToast,
                clearToast,
            }}
        >
            {children}
        </SurgeonsViewContext.Provider>
    );
};

export const useSurgeonsView = () => {
    const context = useContext(SurgeonsViewContext);
    if (!context) {
        throw new Error("useSurgeonsView must be used within SurgeonsViewProvider");
    }
    return context;
};
