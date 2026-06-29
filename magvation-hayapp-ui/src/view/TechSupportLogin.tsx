import { useContext, useEffect, useState, useRef, useCallback } from "react";
import "../viewcss/default.css";
import styles from "./subviewcss/manualLogin.module.css";
import { useTranslation } from "react-i18next";
import { ErrorPopup } from "../component/ErrorPopup";
import { AppContext } from "./App";
import { TechSupportService } from "../services/TechSupportService";
import { VirtualKeyboard } from "../component/VirtualKeyboard";
import eyeIcon from "../img/eyeIcon.svg";

export const TechSupportLogin: React.FC = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [activeField, setActiveField] = useState<"username" | "password" | null>(null);
    const [showError, setShowError] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const appContext = useContext(AppContext);
    const { t } = useTranslation();
    const techSupportService = TechSupportService.instance;
    const lastArrowTimeRef = useRef<number>(0);

    async function handleLogin() {
        if (!username || !password || isLoading || showError) return;

        setIsLoading(true);
        setShowError(false);
        try {
            const result = await techSupportService.login(username, password);
            if (result.success && result.access_token) {
                // Navigate to provision screen
                appContext.navigate({ path: "provision" });
            } else {
                setErrorMessage(result.error || "Login failed");
                setShowError(true);
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "An error occurred during login");
            setShowError(true);
        } finally {
            setIsLoading(false);
        }
    }

    const handleLoginRef = useRef(handleLogin);
    handleLoginRef.current = handleLogin;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger login if there's an error showing or if already loading
            if (showError || isLoading) return;

            // Allow Enter key to submit login
            if (e.key === "Enter" && username && password) {
                handleLoginRef.current();
            } else if (e.key === "ArrowRight") {
                const now = Date.now();
                if (now - lastArrowTimeRef.current < 500) {
                    handleLoginRef.current();
                }
                lastArrowTimeRef.current = now;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [username, password, showError, isLoading]);

    const onKeyClicked = useCallback(
        (keyValue: string) => {
            if (!activeField) return;

            const setter = activeField === "username" ? setUsername : setPassword;

            if (keyValue === "backspace") {
                setter((prev) => prev.slice(0, -1));
            } else if (keyValue === "enter") {
                // Do nothing on enter
            } else if (keyValue === "space") {
                setter((prev) => prev + " ");
            } else if (keyValue.length === 1) {
                setter((prev) => prev + keyValue);
            }
        },
        [activeField],
    );

    const handleInputFocus = (field: "username" | "password") => {
        setActiveField(field);
        // Don't automatically show virtual keyboard - allow physical keyboard input
        // Virtual keyboard can be toggled manually if needed
    };

    const handleInputChange = (field: "username" | "password", value: string) => {
        if (field === "username") {
            setUsername(value);
        } else {
            setPassword(value);
        }
    };

    const handleInputBlur = () => {
        // Keep the field active for virtual keyboard if it was active
        // Don't clear activeField here to allow virtual keyboard to still work
    };

    const handleContainerClick = (e: React.MouseEvent) => {
        // Only dismiss keyboard if clicking directly on the container (not on children)
        if (e.target === e.currentTarget) {
            setActiveField(null);
        }
    };

    return (
        <div className={`${styles.container} ${styles.techSupportBackground}`} onClick={handleContainerClick}>
            <div className={styles.title}>
                {t("setup.techSupportLogin.title", { defaultValue: "Tech Support Login" })}
            </div>

            <div className={styles.form}>
                {/* Username input */}
                <div
                    className={`${styles.inputWrapper} ${activeField === "username" ? styles.inputWrapperActive : ""}`}
                >
                    <input
                        className={styles.input}
                        type="text"
                        placeholder={t("setup.techSupportLogin.username", { defaultValue: "Username" })}
                        value={username}
                        onChange={(e) => handleInputChange("username", e.target.value)}
                        onFocus={() => handleInputFocus("username")}
                        onBlur={handleInputBlur}
                    />
                </div>

                {/* Password input */}
                <div
                    className={`${styles.inputWrapper} ${activeField === "password" ? styles.inputWrapperActive : ""}`}
                >
                    <input
                        className={styles.input}
                        type={showPassword ? "text" : "password"}
                        placeholder={t("setup.techSupportLogin.password", { defaultValue: "Password" })}
                        value={password}
                        onChange={(e) => handleInputChange("password", e.target.value)}
                        onFocus={() => handleInputFocus("password")}
                        onBlur={handleInputBlur}
                    />
                    <button
                        className={styles.eyeButton}
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowPassword((prev) => !prev);
                        }}
                    >
                        <img src={eyeIcon} className={styles.eyeIcon} alt="Toggle password visibility" />
                    </button>
                </div>

                {/* Confirm button */}
                <button
                    className={styles.confirmButton}
                    onClick={handleLogin}
                    disabled={!username || !password || isLoading}
                >
                    {isLoading
                        ? t("setup.techSupportLogin.loggingIn", { defaultValue: "Logging in..." })
                        : t("setup.techSupportLogin.login", { defaultValue: "Login" })}
                </button>
            </div>

            <div className={styles.bottomSection}>
                <div className={styles.keyboardArea}>
                    <VirtualKeyboard onKeyPress={onKeyClicked} />
                </div>
            </div>

            {showError && (
                <ErrorPopup
                    message={errorMessage}
                    onClose={() => {
                        setShowError(false);
                        setPassword("");
                        setIsLoading(false); // Ensure loading is stopped
                    }}
                />
            )}
        </div>
    );
};
