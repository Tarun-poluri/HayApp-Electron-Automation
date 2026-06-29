import React, { useState } from "react";
import styles from "./HayDropdown.module.css";
import ChevronDownIcon from "../img/ChevronDownIcon.svg";

interface HayDropdownProps {
    options: string[];
    placeholder?: string;
    selectedValue?: string;
    onSelect: (value: string) => void;
    className?: string;
}

export function HayDropdown({
    options,
    placeholder = "Not selected",
    selectedValue,
    onSelect,
    className = "",
}: HayDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleItemSelect = (value: string) => {
        onSelect(value);
        setIsOpen(false);
    };

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className={`${styles.dropdownContainer} ${className}`}>
            {isOpen ? (
                <div className={styles.dropdownList}>
                    {options.map((option) => (
                        <button key={option} className={styles.dropdownItem} onClick={() => handleItemSelect(option)}>
                            {option}
                        </button>
                    ))}
                </div>
            ) : (
                <button className={styles.dropdownButton} onClick={toggleDropdown}>
                    <span className={`${styles.dropdownText} ${selectedValue ? styles.dropdownTextSelected : ""}`}>
                        {selectedValue || placeholder}
                    </span>
                    <div className={styles.dropdownIcon}>
                        <img src={ChevronDownIcon} alt="Dropdown" />
                    </div>
                </button>
            )}
        </div>
    );
}
