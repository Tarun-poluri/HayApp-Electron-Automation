/** Figma Screen 3.99 — SCR Scan Pack Confirmation (Section 1 discrepancy path) */
import React, { useContext, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import styles from "../subviewcss/scrScanPackConfirmScreen.module.css";
import buttonStyles from "../subviewcss/scrClosingCountStep.module.css";
import { SuturePackInfo } from "../../services/CaseService";
import { AppContext } from "../App";
import { BasicHeader } from "../../component/BasicHeader";
import SCRHayStackButton from "../../component/SCRHayStackButton";

interface SCRScanPackConfirmScreenProps {
    scannedPackInfo: SuturePackInfo;
    onConfirm: () => void;
    onDeny: () => void;
}

export const SCRScanPackConfirmScreen: React.FC<SCRScanPackConfirmScreenProps> = ({
    scannedPackInfo,
    onConfirm,
    onDeny,
}) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const lastArrowTap = useRef<{ key: string; time: number }>({ key: "", time: 0 });

    // HayStack physical button listener
    useEffect(() => {
        const haystackDefs = appContext.caseService.parlayInterface.hayStack;
        if (!haystackDefs) return;

        const handler = (event: { button: string }) => {
            if (event.button === "yes") {
                onConfirm();
            } else if (event.button === "no") {
                onDeny();
            }
        };
        const unsubscribe = haystackDefs.button_pressed(handler);
        return () => {
            unsubscribe();
        };
    }, [appContext.caseService.parlayInterface.hayStack, onConfirm, onDeny]);

    // Double-tap right arrow = confirm, double-tap down arrow = deny (dev testing)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowDown") return;

            const now = Date.now();
            const last = lastArrowTap.current;

            if (last.key === e.key && now - last.time < 400) {
                if (e.key === "ArrowRight") {
                    onConfirm();
                } else {
                    onDeny();
                }
                lastArrowTap.current = { key: "", time: 0 };
            } else {
                lastArrowTap.current = { key: e.key, time: now };
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onConfirm, onDeny]);

    return (
        <div className={styles.screenContainer}>
            <BasicHeader title={t("section1.addPack.headerTitle")} showHelp />
            <div className={styles.panelRow}>
                <div className={styles.leftPanel}>
                    <div className={styles.imageBackground}>
                        <img
                            className={styles.packImage}
                            src={`http://localhost:8080/suture_pack_images/${scannedPackInfo.image}`}
                            alt={t("section1.addPack.packImageAlt")}
                        />
                    </div>

                    <div className={styles.detailRows}>
                        <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>{t("addedNeedles.needlesPerPack")}</span>
                            <span className={styles.detailValue}>{scannedPackInfo.num_needles}</span>
                        </div>
                        <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>{t("addedNeedles.size")}</span>
                            <span className={styles.detailValue}>{scannedPackInfo.needle_size}</span>
                        </div>
                        <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>{t("addedNeedles.sutureType")}</span>
                            <span className={styles.detailValue}>{scannedPackInfo.suture_type}</span>
                        </div>
                        <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>{t("addedNeedles.needleName")}</span>
                            <span className={styles.detailValue}>{scannedPackInfo.needle_name}</span>
                        </div>
                    </div>
                </div>

                <div className={styles.rightPanel}>
                    <div className={styles.countArea}>
                        <span className={styles.countNumber}>{scannedPackInfo.num_needles}</span>
                        <span className={styles.countText}>{t("scrClosingCount.s1ConfirmPackText")}</span>
                    </div>

                    <div className={styles.buttonRow}>
                        <SCRHayStackButton
                            type="yes"
                            active
                            title={t("scrClosingCount.confirm")}
                            circleClassName={buttonStyles.confirmColor}
                            onClick={onConfirm}
                        />
                        <SCRHayStackButton type="validate" circleClassName={buttonStyles.grayCircle} />
                        <SCRHayStackButton type="action" circleClassName={buttonStyles.grayCircle} />
                        <SCRHayStackButton
                            type="no"
                            active
                            title={t("scrClosingCount.deny")}
                            circleClassName={buttonStyles.noColor}
                            onClick={onDeny}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
