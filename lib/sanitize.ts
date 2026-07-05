/**
 * lib/sanitize.ts
 *
 * Lightweight plain-text sanitizer for short user-supplied fields
 * (names, business names, service names). Strips all HTML tags.
 *
 * Replaces isomorphic-dompurify, which pulls in jsdom → html-encoding-sniffer →
 * an ESM-only transitive dependency that crashes with ERR_REQUIRE_ESM on
 * Vercel's serverless runtime. We never need to allow any HTML here
 * (both call sites used ALLOWED_TAGS: []), so a small regex strip is
 * sufficient and avoids the heavy, fragile dependency entirely.
 */

export function stripHtml(input: string): string {
    return input
        // Drop script/style blocks (and their content) before stripping tags
        .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
        // Strip all remaining tags
        .replace(/<[^>]*>/g, '')
        // Remove any leftover angle brackets (defence in depth)
        .replace(/[<>]/g, '')
        .trim()
}