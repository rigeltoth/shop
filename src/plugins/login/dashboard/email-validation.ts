/**
 * Utilidades de validación de correo electrónico para el registro de vendedores.
 * Incluye validación de formato, dominios comunes y sugerencias ante errores
 * tipográficos comunes (ej: "gmail.cm" → "gmail.com").
 */

/** Dominios de correo más comunes en Colombia para autocompletar/referencia. */
export const COMMON_DOMAINS: string[] = [
    'gmail.com',
    'hotmail.com',
    'outlook.com',
    'yahoo.com',
    'icloud.com',
    'live.com',
    'yahoo.com.co',
    'gmail.com.co',
    'hotmail.es',
    'outlook.es',
];

/** Errores tipográficos comunes de dominios y su corrección. */
const TYPO_DOMAINS: Record<string, string> = {
    'gmail.cm': 'gmail.com',
    'gmail.con': 'gmail.com',
    'gmail.co': 'gmail.com',
    'gmail.om': 'gmail.com',
    'hotmail.cm': 'hotmail.com',
    'hotmal.com': 'hotmail.com',
    'hotmial.com': 'hotmail.com',
    'yaho.com': 'yahoo.com',
    'yahoo.cm': 'yahoo.com',
    'gnail.com': 'gmail.com',
    'outlok.com': 'outlook.com',
    'outloook.com': 'outlook.com',
    'gmai.com': 'gmail.com',
};

/**
 * Valida el formato básico de un correo electrónico.
 * Devuelve true si el correo (recortado) cumple la estructura local@dominio.tld.
 */
export function validateEmailFormat(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Sugiere una corrección cuando el dominio del correo tiene un error tipográfico
 * conocido. Preserva la parte local y sus mayúsculas; solo normaliza el dominio.
 * Devuelve null si no hay una corrección conocida.
 */
export function suggestEmailFix(email: string): { suggestion: string; original: string } | null {
    const trimmed = email.trim();
    const atIndex = trimmed.lastIndexOf('@');
    if (atIndex <= 0 || atIndex === trimmed.length - 1) {
        return null;
    }

    const localPart = trimmed.slice(0, atIndex);
    const domain = trimmed.slice(atIndex + 1).toLowerCase();
    const corrected = TYPO_DOMAINS[domain];

    if (!corrected) {
        return null;
    }

    return {
        suggestion: `${localPart}@${corrected}`,
        original: trimmed,
    };
}