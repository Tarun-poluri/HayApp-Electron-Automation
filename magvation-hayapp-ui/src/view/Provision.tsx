import { useContext, useEffect, useState, useRef, useCallback } from "react";
import "../viewcss/default.css";
import styles from "./subviewcss/manualLogin.module.css";
import { useTranslation } from "react-i18next";
import { ErrorPopup } from "../component/ErrorPopup";
import { AppContext } from "./App";
import { TechSupportService } from "../services/TechSupportService";
import { VirtualKeyboard } from "../component/VirtualKeyboard";

export const Provision: React.FC = () => {
    const [serialNumber, setSerialNumber] = useState("");
    const [activeField, setActiveField] = useState<"serialNumber" | null>(null);
    const [showKeyboard, setShowKeyboard] = useState(false);
    const [isProvisioning, setIsProvisioning] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showError, setShowError] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [syncProgressMessage, setSyncProgressMessage] = useState("");
    const [syncPercent, setSyncPercent] = useState<number | null>(null);
    const appContext = useContext(AppContext);
    const { t } = useTranslation();
    const techSupportService = TechSupportService.instance;
    const lastArrowTimeRef = useRef<number>(0);

    // Fetch device serial number on mount
    useEffect(() => {
        techSupportService
            .getDeviceSerialNumber()
            .then((result) => {
                if (result.serial_number) {
                    setSerialNumber(result.serial_number);
                }
            })
            .catch((error) => {
                console.error("Failed to fetch device serial number:", error);
            });
    }, []); // Run only once on mount

    async function handleProvision() {
        if (!serialNumber) return;

        setIsProvisioning(true);
        setShowError(false);
        setShowSuccess(false);
        try {
            const result = await techSupportService.provision(serialNumber);
            if (result.success && result.api_key) {
                setSuccessMessage(
                    t("setup.provision.success", {
                        defaultValue: "Device provisioned successfully! Sync data from the cloud to continue.",
                    }),
                );
                setShowSuccess(true);
            } else {
                setErrorMessage(result.error || t("setup.provision.failed", { defaultValue: "Provisioning failed" }));
                setShowError(true);
            }
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : t("setup.provision.error", { defaultValue: "An error occurred during provisioning" }),
            );
            setShowError(true);
        } finally {
            setIsProvisioning(false);
        }
    }

    async function handleSyncData() {
        setIsSyncing(true);
        setShowError(false);
        setSyncProgressMessage(t("setup.provision.syncing", { defaultValue: "Syncing..." }));
        setSyncPercent(null);
        const pollInterval = window.setInterval(async () => {
            const progress = await techSupportService.getSyncProgress();
            if (progress.message) {
                setSyncProgressMessage(progress.message);
            }
            setSyncPercent(progress.percent);
        }, 500);
        try {
            const result = await techSupportService.syncGroupData();
            if (result.success) {
                appContext.navigate({ path: "setup" });
            } else {
                setErrorMessage(
                    result.error || t("setup.provision.syncFailed", { defaultValue: "Sync failed. Please try again." }),
                );
                setShowError(true);
            }
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : t("setup.provision.syncError", { defaultValue: "An error occurred during sync." }),
            );
            setShowError(true);
        } finally {
            window.clearInterval(pollInterval);
            setIsSyncing(false);
        }
    }

    const handleProvisionRef = useRef(handleProvision);
    handleProvisionRef.current = handleProvision;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") {
                const now = Date.now();
                if (now - lastArrowTimeRef.current < 500) {
                    handleProvisionRef.current();
                }
                lastArrowTimeRef.current = now;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const onKeyClicked = useCallback(
        (keyValue: string) => {
            if (!activeField) return;

            if (keyValue === "backspace") {
                setSerialNumber((prev) => prev.slice(0, -1));
            } else if (keyValue === "enter") {
                // Do nothing on enter
            } else if (keyValue === "space") {
                setSerialNumber((prev) => prev + " ");
            } else if (keyValue.length === 1) {
                setSerialNumber((prev) => prev + keyValue);
            }
        },
        [activeField],
    );

    const handleInputFocus = () => {
        setActiveField("serialNumber");
        setShowKeyboard(true);
    };

    const handleContainerClick = (e: React.MouseEvent) => {
        // Only dismiss keyboard if clicking directly on the container (not on children)
        if (e.target === e.currentTarget) {
            setActiveField(null);
            setShowKeyboard(false);
        }
    };

    return (
        <div className={`${styles.container} ${styles.techSupportBackground}`} onClick={handleContainerClick}>
            <div className={styles.title}>{t("setup.provision.title", { defaultValue: "Provision Device" })}</div>

            {!showSuccess ? (
                <div className={styles.form}>
                    {/* Serial Number input */}
                    <div
                        className={`${styles.inputWrapper} ${activeField === "serialNumber" ? styles.inputWrapperActive : ""}`}
                        onClick={handleInputFocus}
                    >
                        <input
                            className={styles.input}
                            type="text"
                            placeholder={t("setup.provision.serialNumber", { defaultValue: "Device Serial Number" })}
                            value={serialNumber}
                            readOnly
                        />
                    </div>

                    {/* Provision button */}
                    <button
                        className={styles.confirmButton}
                        onClick={handleProvision}
                        disabled={!serialNumber || isProvisioning}
                    >
                        {isProvisioning
                            ? t("setup.provision.provisioning", { defaultValue: "Provisioning..." })
                            : t("setup.provision.provision", { defaultValue: "Provision" })}
                    </button>
                </div>
            ) : (
                <div className={styles.form}>
                    <div className={styles.successMessage}>
                        {successMessage.split("\n").map((line, index) => (
                            <div key={index} style={{ marginBottom: index === 0 ? "16px" : "8px" }}>
                                {line}
                            </div>
                        ))}
                    </div>
                    <button className={styles.confirmButton} onClick={handleSyncData} disabled={isSyncing}>
                        {isSyncing
                            ? t("setup.provision.syncing", { defaultValue: "Syncing..." })
                            : t("setup.provision.syncData", { defaultValue: "Sync Data From Cloud" })}
                    </button>
                    {isSyncing && (
                        <div className={styles.successMessage}>
                            <div>{syncProgressMessage}</div>
                            {typeof syncPercent === "number" && (
                                <div className={styles.syncPercentLabel}>{`${syncPercent}%`}</div>
                            )}
                            <div className={styles.syncProgressTrack}>
                                <div
                                    className={
                                        typeof syncPercent === "number"
                                            ? styles.syncProgressFill
                                            : styles.syncProgressFillIndeterminate
                                    }
                                    style={typeof syncPercent === "number" ? { width: `${syncPercent}%` } : undefined}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Back button - shown only when keyboard is hidden and not showing success */}
            {!showKeyboard && !showSuccess && (
                <button
                    className={styles.scanBadgeButton}
                    onClick={() => {
                        appContext.navigate({ path: "techSupportLogin" });
                    }}
                >
                    {t("setup.provision.back", { defaultValue: "Back" })}
                </button>
            )}

            {/* Keyboard bottom section */}
            {showKeyboard && !showSuccess && (
                <div className={styles.bottomSection}>
                    <div className={styles.keyboardArea}>
                        <VirtualKeyboard onKeyPress={onKeyClicked} />
                    </div>
                </div>
            )}

            {showError && (
                <ErrorPopup
                    message={errorMessage}
                    onClose={() => {
                        setShowError(false);
                    }}
                />
            )}
        </div>
    );
};
