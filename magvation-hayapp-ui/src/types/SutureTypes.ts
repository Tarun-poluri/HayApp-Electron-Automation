/**
 * Type definitions for Suture Sheet data model
 *
 * Data flow:
 * - Surgeon has suture_sheet_ids[] linking to SutureSheets
 * - SutureSheet has cpt_code linking to CaseType
 * - SutureSheet contains SutureSheetItems (the actual suture products)
 *
 */

import { SutureNeedleCategory } from "../component/CategoryBadge";

/**
 * Case Type - represents a surgical procedure type
 * Case types are surgeon-agnostic (not tied to a specific surgeon)
 */
export interface CaseType {
    case_type_id: string;
    name: string;
    cpt_code: string;
    is_primary: boolean;
    secondary_cpt_codes?: string[];
    description?: string;
}

/**
 * Surgeon - represents a surgeon who performs procedures
 * Each surgeon has their own set of suture sheets
 */
export interface Surgeon {
    surgeon_id: string;
    first_name: string;
    last_name: string;
    cyphermed_user_id?: string;
    suture_sheet_ids: string[]; // Links to SutureSheet by suture_sheet_id
}

/**
 * Suture Sheet - a surgeon's preferred suture configuration for a specific CPT code or combination of CPT codes
 * Each suture sheet is unique to one surgeon (no sharing between surgeons)
 *
 * For combo cases, a single suture sheet can cover multiple CPT codes (e.g., ["33430", "+33518"])
 * This allows surgeons to have pre-built sheets for common procedure combinations
 */
export interface SutureSheet {
    suture_sheet_id: string;
    cpt_codes: string[]; // One or more CPT codes this sheet covers (supports combo sheets)
    suture_sheet_items: SutureSheetItem[];
    date_created?: string;
    last_edited?: string;
}

/**
 * Suture Sheet Item - individual suture product on a suture sheet
 * Represents the surgeon's preference for a specific suture product
 *
 * MINIMAL CLOUD-CONTROLLED STRUCTURE - Do not add fields here!
 * This matches the backend SutureSheetItem model exactly.
 * For enriched display data, use EnrichedSutureSheetItem instead.
 */
export interface SutureSheetItem {
    fda_gudid: number; // FDA GUID to lookup full pack info
    suture_needle_use: string[];
    suture_needle_category: SutureNeedleCategory;
    num_packs: number;
}

/**
 * Enriched Suture Sheet Item - includes pack info and case type tracking
 * Used when displaying suture sheet items with full details in Summary Sheet
 *
 * Built by backend from minimal SutureSheetItem + SuturePackInfo lookup.
 * Contains all display fields needed for UI without additional lookups.
 * All display fields are guaranteed to be populated by backend enrichment.
 */
export interface EnrichedSutureSheetItem extends SutureSheetItem {
    id: string; // Unique identifier for UI rendering
    cptCode: string | null; // Null = aggregated item, otherwise CPT code for filtering
    product_code: string; // Product code (e.g., "V396H")
    nomenclature: string; // Pre-formatted: "3-0 PROLENE SH"
    needles_per_pack: number; // Needles per pack
    suture_gauge: string; // e.g., "3-0"
    suture_type: string; // e.g., "PROLENE"
    needle_name: string; // e.g., "SH"
}

/**
 * Runtime type for Review Redundant Needles screen
 * Derived from SutureSheetItem with additional runtime state
 */
export interface RedundantNeedleItem {
    id: string;
    nomenclature: string;
    subLabel: string; // product_code
    needlesPerPack: number;
    packsToOpen: number; // num_packs from SutureSheetItem
    sutureNeedleUse: string | string[]; // Can be a single string or array of uses
    sutureNeedleCategory: SutureNeedleCategory;
    potentialRedundantPack: number; // User-adjusted at runtime, initialized to 0
    cptCode?: string; // Tracks which case type this item belongs to (for filtering)
    fdaGudid?: number; // FDA GUDID for looking up full pack info
    // Additional fields from SuturePackInfo for detailed display
    image?: string; // Pack image filename (e.g., "8703H_pack.png")
    manufacturer?: string; // Manufacturer name (e.g., "ETHICON")
    sutureLength?: string; // Suture length (e.g., "30\" (75cm)")
    sutureColor?: string; // Suture color (e.g., "Blue")
    sutureStyle?: string; // Suture style (e.g., "Monofilament")
    needleSize?: string; // Needle size (e.g., "9.3mm")
    needleArc?: string; // Needle arc (e.g., "3/8 Circle")
    needleTip?: string; // Needle tip type (e.g., "Taper Point")
    numSutures?: number; // Number of sutures per pack
}

/**
 * Result type for getMergedSutureItems helper function
 */
export interface MergedSutureItemsResult {
    items: RedundantNeedleItem[];
    missingCptCodes: string[];
}
