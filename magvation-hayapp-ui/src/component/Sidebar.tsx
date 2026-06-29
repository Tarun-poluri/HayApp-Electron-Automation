import React, { useState, useContext } from "react";
import styles from "./Sidebar.module.css";
import { AppContext } from "../view/App";

import magIcon from "../img/magIcon.svg";
import magTitle from "../img/magTitle.svg";
import hamburgerMenu from "../img/hamburgerMenu.svg";
import reliefIcon from "../img/Relief.svg";
import interimIcon from "../img/Interim.svg";
import closingIcon from "../img/Closing.svg";
import helpIcon from "../img/HelpIcon.svg";
import { useTranslation } from "react-i18next";
import packageJson from "../../package.json";

interface SidebarButtonProps {
    icon: string;
    text: string;
    alt?: string;
    onClick?: () => void;
}

const SidebarButton: React.FC<SidebarButtonProps> = ({ icon, text, alt, onClick }) => {
    const { t } = useTranslation();
    const isClosing = text === t("sidebar.closeCount");
    return (
        <div
            className={styles.menuButtonContainer}
            onClick={onClick}
            style={{ cursor: onClick ? "pointer" : "default" }}
        >
            <div className={`${styles.menuButton} ${isClosing ? styles.closingCountButton : ""}`}>
                <img src={icon} alt={alt || text} />
            </div>
            <div className={styles.menuButtonText}>{text}</div>
        </div>
    );
};

export interface SidebarProps {
    onInterimCountClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onInterimCountClick }) => {
    const { t } = useTranslation();
    const appContext = useContext(AppContext);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleMenuToggle = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const handleCloseCase = async () => {
        setIsMenuOpen(false);
        try {
            // Close any open scanner screen before aborting
            await appContext.caseService.parlayInterface.hayScanner.close_active_screen();

            // Clear backend state
            await appContext.caseService.parlayInterface.caseManager.reset_haystack();
            await appContext.caseService.parlayInterface.caseManager.clear_case();

            // Reset all frontend state
            appContext.caseService.resetAllState();

            // Navigate back to setup (initial screen)
            appContext.navigate({ path: "setup" });
        } catch (error) {
            console.error("Failed to abort case:", error);
        }
    };

    return (
        <div className={styles.sidebar}>
            <div className={styles.topContainer}>
                <div className={styles.logoContainer}>
                    <div className={styles.logoGroup}>
                        <img src={magIcon} alt="Logo Icon" className={styles.iconLogo} />
                        <img src={magTitle} alt="Logo Title" className={styles.titleLogo} />
                    </div>
                </div>
                <div className={styles.rectangle}></div>
                <div className={styles.menuContainer}>
                    <div className={styles.menuIconContainer} onClick={handleMenuToggle} style={{ cursor: "pointer" }}>
                        <div className={styles.menuIcon}>
                            <img src={hamburgerMenu} alt="Menu Icon" />
                        </div>
                        <div className={styles.menuText}>Menu</div>
                    </div>
                    {isMenuOpen && (
                        <div className={styles.menuDropdown}>
                            <button className={styles.menuDropdownItem} onClick={handleCloseCase}>
                                {t("sidebar.abortCase")}
                            </button>
                            <div className={styles.menuVersionText}>v{packageJson.version}</div>
                        </div>
                    )}
                </div>
                <div className={styles.rectangle}></div>
            </div>
            <div className={styles.middleContainer}>
                <SidebarButton icon={reliefIcon} text={t("sidebar.reliefCount")} />
                <SidebarButton
                    icon={interimIcon}
                    text={t("sidebar.interimCount")}
                    onClick={onInterimCountClick ?? (() => appContext.navigate({ path: "cirInterimCount" }))}
                />
                <SidebarButton icon={closingIcon} text={t("sidebar.closeCount")} />
            </div>
            <div className={styles.bottomContainer}>
                <div className={styles.rectangle}></div>
                <div className={styles.helpContainer}>
                    <div className={styles.helpIcon}>
                        <img src={helpIcon} alt="Help Icon" />
                    </div>
                    <div className={styles.helpText}>{t("sidebar.help")}</div>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
