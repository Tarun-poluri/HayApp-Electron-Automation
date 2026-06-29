import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "../subviewcss/manualLogin.module.css";
import { useTranslation } from "react-i18next";
import { HayAppUserType } from "../../services/StaffService";
import { VirtualKeyboard } from "../../component/VirtualKeyboard";
import { ErrorPopup } from "../../component/ErrorPopup";
import eyeIcon from "../../img/eyeIcon.svg";

interface ManualLoginProps {
    role: HayAppUserType;
    onConfirm: (email: string, password: string) => void;
    onScanBadge: () => void;
    manualNav?: boolean;
    errorMessage?: string | null;
    onDismissError?: () => void;
}

export const ManualLogin: React.FC<ManualLoginProps> = ({
    role,
    onConfirm,
    onScanBadge,
    manualNav = true,
    errorMessage,
    onDismissError,
}) => {
    const { t } = useTranslation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [activeField, setActiveField] = useState<"email" | "password" | null>(null);
    const [showKeyboard, setShowKeyboard] = useState(false);
    const lastArrowTimeRef = useRef<number>(0);
    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);

    const roleName = role === HayAppUserType.Circulator ? "CIR" : "SCR";

    // Development: press right-arrow twice within 500ms to confirm
    useEffect(() => {
        if (!manualNav) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") {
                const now = Date.now();
                if (now - lastArrowTimeRef.current < 500) {
                    onConfirm(email, password);
                }
                lastArrowTimeRef.current = now;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [manualNav, onConfirm, email, password]);

    const onKeyClicked = useCallback(
        (keyValue: string) => {
            if (!activeField) return;

            const setter = activeField === "email" ? setEmail : setPassword;

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

    const handleInputFocus = (field: "email" | "password") => {
        setActiveField(field);
        setShowKeyboard(true);
        requestAnimationFrame(() => {
            const ref = field === "email" ? emailRef : passwordRef;
            ref.current?.focus();
        });
    };

    const handleContainerClick = (e: React.MouseEvent) => {
        // Only dismiss keyboard if clicking directly on the container (not on children)
        if (e.target === e.currentTarget) {
            setActiveField(null);
            setShowKeyboard(false);
        }
    };

    return (
        <div className={styles.container} onClick={handleContainerClick}>
            <div className={styles.title}>
                {t("setup.manualLogin.title", { defaultValue: "Log in using email and password" })}
            </div>

            <div className={styles.form}>
                {/* Email input */}
                <div
                    className={`${styles.inputWrapper} ${activeField === "email" ? styles.inputWrapperActive : ""}`}
                    onClick={() => handleInputFocus("email")}
                >
                    <input
                        ref={emailRef}
                        className={styles.input}
                        type="text"
                        placeholder={t("setup.manualLogin.email", { defaultValue: "Email Address" })}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={() => handleInputFocus("email")}
                        autoComplete="off"
                        spellCheck={false}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && email && password) onConfirm(email, password);
                        }}
                    />
                </div>

                {/* Password input */}
                <div
                    className={`${styles.inputWrapper} ${activeField === "password" ? styles.inputWrapperActive : ""}`}
                    onClick={() => handleInputFocus("password")}
                >
                    <input
                        ref={passwordRef}
                        className={styles.input}
                        type={showPassword ? "text" : "password"}
                        placeholder={t("setup.manualLogin.password", { defaultValue: "Password" })}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => handleInputFocus("password")}
                        autoComplete="off"
                        spellCheck={false}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && email && password) onConfirm(email, password);
                        }}
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
                    className={`${styles.confirmButton} ${!email || !password ? styles.confirmButtonDisabled : ""}`}
                    onClick={() => onConfirm(email, password)}
                    disabled={!email || !password}
                >
                    {t("setup.manualLogin.login", { defaultValue: "Log In" })}
                </button>
            </div>

            {/* Scan Badge button - shown only when keyboard is hidden */}
            {!showKeyboard && (
                <button className={styles.scanBadgeButton} onClick={onScanBadge}>
                    {t("setup.manualLogin.scanBadge", {
                        role: roleName,
                        defaultValue: `Scan Badge to Log In as ${roleName}`,
                    })}
                </button>
            )}

            {/* Keyboard bottom section */}
            {showKeyboard && (
                <div className={styles.bottomSection}>
                    <div className={styles.keyboardArea}>
                        <VirtualKeyboard onKeyPress={onKeyClicked} />
                    </div>
                </div>
            )}

            {errorMessage && <ErrorPopup message={errorMessage} onClose={onDismissError ?? (() => {})} />}
        </div>
    );
};
