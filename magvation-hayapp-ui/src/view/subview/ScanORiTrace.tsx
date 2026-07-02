import React, { useEffect, useRef } from "react";
import styles from "../subviewcss/scanORiTrace.module.css";
import { useTranslation } from "react-i18next";

import { TrackingHeader } from "./TrackingHeader";
import { HayAppUser } from "../../services/StaffService";
import RoomScanImg from "../../img/RoomScan.svg";

interface ScanORiTraceProps {
    onScanSuccess: () => void;
    onBack: () => void;
    manualNav?: boolean; // Enable two right-arrow override for navigation
    stage?: number;
    showAbortButton?: boolean;
    onAbortCase?: () => void;
    circulatorUser?: HayAppUser;
    scrubUser?: HayAppUser;
    showBadges?: boolean;
    onCirLogout?: () => void;
    onScrLogout?: () => void;
    onCirLogin?: () => void;
    onScrLogin?: () => void;
}

export const ScanORiTrace: React.FC<ScanORiTraceProps> = ({
    onScanSuccess,
    onBack,
    manualNav = false,
    stage = 1,
    showAbortButton = false,
    onAbortCase,
    circulatorUser,
    scrubUser,
    showBadges = false,
    onCirLogout,
    onScrLogout,
    onCirLogin,
    onScrLogin,
}) => {
    const { t } = useTranslation();
    const lastArrowTimeRef = useRef<number>(0);

    // Development: press right-arrow twice within 500ms to advance
    useEffect(() => {
        if (!manualNav) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") {
                const now = Date.now();
                if (now - lastArrowTimeRef.current < 500) {
                    onScanSuccess();
                }
                lastArrowTimeRef.current = now;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [manualNav, onScanSuccess]);

    // Auto-advance after delay (disabled when manualNav is true)
    useEffect(() => {
        if (manualNav) return;

        const timer = setTimeout(() => {
            onScanSuccess();
        }, 5000);
        return () => clearTimeout(timer);
    }, [manualNav, onScanSuccess]);

    return (
        <div className={styles.container}>
            <TrackingHeader
                stage={stage}
                title={t("setup.scanORiTrace.headerTitle") || "Scan Room"}
                onBack={onBack}
                showAbortButton={showAbortButton}
                onAbortCase={onAbortCase}
                circulatorUser={circulatorUser}
                scrubUser={scrubUser}
                showBadges={showBadges}
                onCirLogout={onCirLogout}
                onScrLogout={onScrLogout}
                onCirLogin={onCirLogin}
                onScrLogin={onScrLogin}
            />
            {/* Placeholder for Camera/Image */}
            <img src={RoomScanImg} className={styles.cameraArea} alt="Camera Preview" />
            <div className={styles.subtitle}>
                {t("setup.scanORiTrace.subtitle") ||
                    "Please scan the room's iTrace code to link this case to the correct operating room."}
            </div>
            <button
                onClick={onScanSuccess}
                style={{
                    position: "fixed", bottom: "32px", right: "32px",
                    background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)",
                    borderRadius: "8px", color: "rgba(255,255,255,0.6)", fontSize: "13px",
                    padding: "8px 16px", cursor: "pointer",
                }}
            >
                Skip →
            </button>
        </div>
    );
};
