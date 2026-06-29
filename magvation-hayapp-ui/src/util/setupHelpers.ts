/**
 * Utility functions for Setup workflow
 * Replaces mock data helper functions with real service-based utilities
 */

import { Surgeon } from "../services/StaffService";
import { SuturePackInfo } from "../services/CaseService";
import { NeedleDetailSpecifications } from "../types/NeedleDetailTypes";

/**
 * Format a suture needle use string for display.
 * Lowercases everything, then capitalizes the first letter of the first word.
 */
export function formatNeedleUse(use: string | string[]): string {
    const raw = Array.isArray(use) ? use.join(", ") : use;
    const lower = raw.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Get formatted full name for a surgeon
 */
export function getSurgeonFullName(surgeon: Surgeon | null): string {
    if (!surgeon) return "";
    return `${surgeon.first_name} ${surgeon.last_name}`;
}

/**
 * Convert SuturePackInfo from backend into NeedleDetailSpecifications for the UI
 */
export function getNeedleSpecifications(packInfo: SuturePackInfo | null): NeedleDetailSpecifications {
    if (!packInfo) {
        // Return default specifications if pack info not found
        return {
            suture: {
                type: "Unknown",
                gauge: "N/A",
                length: "N/A",
                color: "N/A",
                style: "N/A",
                parLevel: "N/A",
            },
            needle: {
                type: "Unknown",
                size: "N/A",
                arc: "N/A",
                tip: "N/A",
                manufacturer: "Unknown",
            },
            image: "",
        };
    }

    return {
        suture: {
            type: packInfo.suture_type || "Unknown",
            gauge: packInfo.suture_gauge || "N/A",
            length: packInfo.suture_length || "N/A",
            color: packInfo.suture_color || "N/A",
            style: packInfo.suture_style || "N/A",
            parLevel: "N/A", // Backend doesn't provide this yet
        },
        needle: {
            type: packInfo.needle_type || "Unknown",
            size: packInfo.needle_size || packInfo.needle_name || "N/A",
            arc: packInfo.needle_arc || "N/A",
            tip: packInfo.needle_tip || "N/A",
            manufacturer: packInfo.manufacturer || "Unknown",
        },
        image: packInfo.image || "",
    };
}
