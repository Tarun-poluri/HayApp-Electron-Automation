/**
 * Type definitions for Needle Detail screen specifications
 */

/**
 * Suture specifications (left column in specs card)
 */
export interface SutureSpecifications {
    type: string; // e.g., "PROLENE", "VICRYL", "ETHIBOND"
    gauge: string; // e.g., "3-0", "4-0", "6-0"
    length: string; // e.g., "18 in", "75 cm"
    color: string; // e.g., "Blue", "Violet", "Green"
    style: string; // e.g., "Braided", "Monofilament"
    parLevel: string; // e.g., "10", "15"
}

/**
 * Needle specifications (right column in specs card)
 */
export interface NeedleSpecifications {
    type: string; // e.g., "MH-1 Plus", "Taper", "Cutting"
    size: string; // e.g., "31 mm", "SH", "C-1"
    arc: string; // e.g., "1/2c", "3/8 Circle"
    tip: string; // e.g., "Taperpoint", "Cutting", "Blunt"
    manufacturer: string; // e.g., "Ethicon", "Covidien"
}

/**
 * Combined specifications for the Needle Detail screen
 */
export interface NeedleDetailSpecifications {
    suture: SutureSpecifications;
    needle: NeedleSpecifications;
    image: string;
}
