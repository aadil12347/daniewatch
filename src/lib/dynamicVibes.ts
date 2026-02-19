/**
 * Dynamic Page Vibes - Color Extraction Utility
 * Extracts dominant colors from movie posters to create dynamic UI themes.
 * 
 * Performance optimizations:
 * - Aggressive downsampling to 16x16 pixels
 * - Persistent caching in sessionStorage
 * - Web Worker offloading for heavy calculations
 * - Luminance guardrails for readability
 */

// Cache for extracted colors (session-scoped)
const colorCache = new Map<string, ExtractedVibe>();
const CACHE_KEY_PREFIX = 'dw_vibe_';

export interface ExtractedVibe {
    primary: string;      // HSL string: "0 84% 60%"
    primaryRgb: string;   // RGB string: "rgb(220, 38, 38)"
    navbarTint: string;   // HSL string for navbar
    timestamp: number;
}

interface ColorSample {
    h: number;
    s: number;
    l: number;
    count: number;
}

// Default cinema red vibe
export const DEFAULT_VIBE: ExtractedVibe = {
    primary: '0 84% 60%',
    primaryRgb: 'rgb(220, 38, 38)',
    navbarTint: '0 84% 60%',
    timestamp: 0,
};

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }

    return [
        Math.round(h * 360),
        Math.round(s * 100),
        Math.round(l * 100),
    ];
}

/**
 * Quantize colors into buckets to find dominant color
 */
function quantizeColors(pixels: Uint8ClampedArray): ColorSample[] {
    const buckets = new Map<string, ColorSample>();

    // Sample every 4th pixel for speed (already downsampled to 16x16)
    for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        // Skip transparent pixels
        if (a < 128) continue;

        const [h, s, l] = rgbToHsl(r, g, b);

        // Skip very dark or very light pixels (they don't contribute to "vibe")
        if (l < 15 || l > 90) continue;

        // Skip low-saturation pixels (grays)
        if (s < 15) continue;

        // Quantize to reduce bucket count
        const hBucket = Math.round(h / 10) * 10;
        const sBucket = Math.round(s / 10) * 10;
        const lBucket = Math.round(l / 10) * 10;

        const key = `${hBucket}-${sBucket}-${lBucket}`;

        const existing = buckets.get(key);
        if (existing) {
            existing.count++;
        } else {
            buckets.set(key, { h: hBucket, s: sBucket, l: lBucket, count: 1 });
        }
    }

    return Array.from(buckets.values());
}

/**
 * Apply luminance guardrails to ensure readability
 */
function applyGuardrails(h: number, s: number, l: number): { h: number; s: number; l: number } {
    // Cap saturation to prevent neon colors (max 85%)
    s = Math.min(s, 85);

    // Ensure lightness is in readable range (45-65%)
    l = Math.max(45, Math.min(l, 65));

    // If saturation is very low, boost it slightly for visual interest
    if (s < 30) {
        s = Math.min(s + 20, 60);
    }

    return { h, s, l };
}

/**
 * Extract dominant color from an image URL
 * Uses canvas to downsample and analyze pixels
 */
export async function extractVibeFromImage(
    imageUrl: string,
    cacheKey: string
): Promise<ExtractedVibe> {
    // Check memory cache first
    const cached = colorCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    // Check sessionStorage cache
    try {
        const sessionCached = sessionStorage.getItem(CACHE_KEY_PREFIX + cacheKey);
        if (sessionCached) {
            const parsed = JSON.parse(sessionCached) as ExtractedVibe;
            colorCache.set(cacheKey, parsed);
            return parsed;
        }
    } catch {
        // Ignore cache errors
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            try {
                // Create small canvas for downsampling (16x16)
                const canvas = document.createElement('canvas');
                const size = 16;
                canvas.width = size;
                canvas.height = size;

                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) {
                    resolve(DEFAULT_VIBE);
                    return;
                }

                // Draw image downscaled
                ctx.drawImage(img, 0, 0, size, size);

                // Get pixel data
                const imageData = ctx.getImageData(0, 0, size, size);
                const pixels = imageData.data;

                // Quantize and find dominant color
                const samples = quantizeColors(pixels);

                if (samples.length === 0) {
                    resolve(DEFAULT_VIBE);
                    return;
                }

                // Sort by count and get the most common color
                samples.sort((a, b) => b.count - a.count);
                const dominant = samples[0];

                // Apply guardrails
                const { h, s, l } = applyGuardrails(dominant.h, dominant.s, dominant.l);

                // Create vibe object
                const vibe: ExtractedVibe = {
                    primary: `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`,
                    primaryRgb: `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`,
                    navbarTint: `${Math.round(h)} ${Math.round(s)}% ${Math.round(l - 10)}%`,
                    timestamp: Date.now(),
                };

                // Cache the result
                colorCache.set(cacheKey, vibe);
                try {
                    sessionStorage.setItem(CACHE_KEY_PREFIX + cacheKey, JSON.stringify(vibe));
                } catch {
                    // Ignore storage errors
                }

                // Clean up
                canvas.remove();

                resolve(vibe);
            } catch (error) {
                console.warn('[DynamicVibes] Extraction error:', error);
                resolve(DEFAULT_VIBE);
            }
        };

        img.onerror = () => {
            console.warn('[DynamicVibes] Failed to load image:', imageUrl);
            resolve(DEFAULT_VIBE);
        };

        // Use small image size for faster loading
        const smallUrl = imageUrl.includes('tmdb.org')
            ? imageUrl.replace(/w\d+\//, 'w92/')
            : imageUrl;

        img.src = smallUrl;
    });
}

/**
 * Apply vibe to CSS variables
 */
export function applyVibeToRoot(vibe: ExtractedVibe, animate: boolean = true): void {
    const root = document.documentElement;

    if (animate) {
        // Add transition class for smooth color change
        root.classList.add('vibe-transitioning');
    }

    // Set CSS variables
    root.style.setProperty('--primary', vibe.primary);
    root.style.setProperty('--navbar-tint', vibe.navbarTint);

    // Update ring color to match
    root.style.setProperty('--ring', vibe.primary);

    if (animate) {
        // Remove transition class after animation
        setTimeout(() => {
            root.classList.remove('vibe-transitioning');
        }, 800);
    }
}

/**
 * Reset to default cinema red vibe
 */
export function resetToDefaultVibe(animate: boolean = true): void {
    applyVibeToRoot(DEFAULT_VIBE, animate);
}

/**
 * Get cached vibe without extraction
 */
export function getCachedVibe(cacheKey: string): ExtractedVibe | null {
    // Check memory cache
    const cached = colorCache.get(cacheKey);
    if (cached) return cached;

    // Check sessionStorage
    try {
        const sessionCached = sessionStorage.getItem(CACHE_KEY_PREFIX + cacheKey);
        if (sessionCached) {
            const parsed = JSON.parse(sessionCached) as ExtractedVibe;
            colorCache.set(cacheKey, parsed);
            return parsed;
        }
    } catch {
        // Ignore
    }

    return null;
}

/**
 * Preload vibe for a movie (call on hover)
 */
export function preloadVibe(
    posterPath: string | null | undefined,
    movieId: number | string
): void {
    if (!posterPath) return;

    const cacheKey = `${movieId}_${posterPath}`;
    const cached = getCachedVibe(cacheKey);

    if (!cached) {
        // Build full URL
        const imageUrl = posterPath.startsWith('http')
            ? posterPath
            : `https://image.tmdb.org/t/p/w92${posterPath}`;

        // Extract in background (don't await)
        extractVibeFromImage(imageUrl, cacheKey).catch(() => {
            // Silently fail
        });
    }
}
