import TaperPoint from "../img/TaperPoint.svg";
import Tapercut from "../img/Tapercut.svg";
import Spatula from "../img/Spatula.svg";
import ReverseCutting from "../img/ReverseCutting.svg";
import PrimeReverseCutting from "../img/PrimeReverseCutting.svg";
import PrimeConventionalCutting from "../img/PrimeConventionalCutting.svg";
import CenterpointSpatula from "../img/CenterpointSpatula.svg";

/**
 * Maps needle tip type names to their corresponding SVG icons.
 * Supports all 7 tip types:
 * - Taper Point
 * - Tapercut
 * - Spatula
 * - Reverse Cutting
 * - Prime Reverse Cutting
 * - Prime Conventional Cutting (also matches "Conventional Cutting")
 * - Centerpoint Spatula
 *
 * @param needleTip - The needle tip type name from the database (e.g., "Taper Point", "Conventional Cutting")
 * @returns The SVG icon path for the tip type, defaults to TaperPoint if not matched
 */
export const getTipTypeIcon = (needleTip?: string): string => {
    if (!needleTip) return TaperPoint;

    // Normalize the input: lowercase and remove spaces/hyphens for matching
    const tipLower = needleTip.toLowerCase().replace(/[\s]+/g, "");

    // Check for Centerpoint Spatula first (must include both words)
    if (tipLower.includes("centerpoint") && tipLower.includes("spatula")) {
        return CenterpointSpatula;
    }

    // Check for specific tip types
    if (tipLower.includes("taperpoint")) return TaperPoint;
    if (tipLower.includes("tapercut")) return Tapercut;
    if (tipLower.includes("spatula")) return Spatula;
    if (tipLower.includes("reversecutting") || tipLower === "reversecutting") return ReverseCutting;
    if (tipLower.includes("primereversecutting") || tipLower === "primereversecutting") return PrimeReverseCutting;

    // Match both "Prime Conventional Cutting" and just "Conventional Cutting"
    if (
        tipLower.includes("primeconventionalcutting") ||
        tipLower.includes("conventionalcutting") ||
        tipLower === "primeconventionalcutting" ||
        tipLower === "conventionalcutting"
    ) {
        return PrimeConventionalCutting;
    }

    // Default to TaperPoint if we can't match
    return TaperPoint;
};
