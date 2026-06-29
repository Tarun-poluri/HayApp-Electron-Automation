import React, { useContext, useState, useEffect } from "react";
import styles from "./InfoBar.module.css";
import { useTranslation } from "react-i18next";
import { AppContext } from "../view/App";
import { useListenable } from "../util/Listenable";

const InfoSection: React.FC<{
    title: React.ReactNode;
    info: React.ReactNode;
    icon?: React.ReactNode;
    children?: React.ReactNode;
}> = ({ title, info, icon, children }) => (
    <div className={styles.sectionContainer}>
        <div className={styles.sectionTitleContainer}>
            <span className={styles.sectionTitleText}>{title}</span>
            {icon}
        </div>
        <div className={styles.sectionInfoText}>
            {info}
            {children}
        </div>
    </div>
);

export interface InfoBarProps {
    showLit?: boolean;
    showAbortButton?: boolean;
    onAbortCase?: () => void;
}

const InfoBar: React.FC<InfoBarProps> = ({ showLit = true, showAbortButton = false, onAbortCase }) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const circulator = useListenable(appContext.caseService.circulator);
    const scrub = useListenable(appContext.caseService.scrub);
    const surgeon = useListenable(appContext.caseService.surgeon);
    const surgeonCount = useListenable(appContext.caseService.surgeonCount);
    const firstSurgeonName = useListenable(appContext.caseService.firstSurgeonName);
    const [currentTime, setCurrentTime] = useState<string>("");

    useEffect(() => {
        const formatter = new Intl.DateTimeFormat(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
        });
        const formatTime = () => formatter.format(new Date());

        setCurrentTime(formatTime());
        const interval = setInterval(() => {
            setCurrentTime(formatTime());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className={styles.infoBarContainer}>
            {showLit && (
                <>
                    <div className={styles.verticalBar}></div>
                    <InfoSection title={t("infoBar.time")} info={<span>{currentTime}</span>} />
                </>
            )}
            <div className={styles.verticalBar}></div>
            <InfoSection
                title={surgeonCount > 1 ? t("infoBar.surgeons") : t("infoBar.surgeon")}
                info={
                    <span>
                        {surgeonCount > 1
                            ? `${surgeonCount} ${t("infoBar.surgeonsLower")}`
                            : firstSurgeonName || (surgeon ? surgeon.first_name + " " + surgeon.last_name : "")}
                    </span>
                }
            />
            <div className={styles.verticalBar}></div>
            <InfoSection
                title={t("infoBar.cir")}
                info={<span>{circulator ? circulator.first_name + " " + circulator.last_name : ""}</span>}
            />
            <div className={styles.verticalBar}></div>
            <InfoSection
                title={t("infoBar.scr")}
                info={<span>{scrub ? scrub.first_name + " " + scrub.last_name : ""}</span>}
            />
            {showAbortButton && (
                <>
                    <div className={styles.verticalBar}></div>
                    <button className={styles.abortButton} onClick={onAbortCase}>
                        <span className={styles.abortText}>{t("infoBar.abortCase")}</span>
                    </button>
                </>
            )}
        </div>
    );
};

export default InfoBar;
