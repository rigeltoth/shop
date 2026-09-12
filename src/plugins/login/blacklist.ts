import { UserInputError } from '@vendure/core';

/**
 * Palabras prohibidas para nombres de tienda y otros textos públicos.
 * Se normalizan a minúsculas sin tildes antes de comparar, por lo que
 * aquí también se guardan sin tildes.
 */
export const FORBIDDEN_WORDS: string[] = [
    'ecommer',
    'puta',
    'puto',
    'pinche',
    'mierda',
    'pendejo',
    'pendeja',
    'hijueputa',
    'hijoputa',
    'hijodeputa',
    'hp',
    'coño',
    'culo',
    'verga',
    'vergacion',
    'marica',
    'maricon',
    'malparido',
    'malparida',
    'gonorrea',
    'carechimba',
    'chimba',
    'perra',
    'perro',
    'zorra',
    'estupido',
    'estupida',
    'idiota',
    'imbecil',
    'tonto',
    'tonta',
    'tarado',
    'tarada',
    'retrasado',
    'retrasada',
    'basura',
    'asqueroso',
    'asquerosa',
    'culo',
    'nalga',
    'chichon',
    'chocha',
    'pija',
    'pinga',
    'bicho',
    'wea',
    'webada',
    'culo',
    'vrga',
    'mrd',
    'mrdn',
    'xingar',
    'follar',
    'joder',
    'joda',
    'cojones',
    'cojudo',
    'cojuda',
    'boludo',
    'boluda',
    'gilipollas',
    'cabron',
    'cabrona',
    'desgraciado',
    'desgraciada',
    'pencazo',
    'mamón',
    'mamona',
    'mamon',
    'mamerta',
    'chupapinga',
    'comedor de mierda',
    'esclavo',
    'drogadicto',
    'drogadicta',
    'narco',
    'narcotraficante',
    'sicario',
    'sicaria',
    'violador',
    'violadora',
    'asesino',
    'asesina',
    'terrorista',
    'suicida',
    'trampa',
    'estafa',
    'estafador',
    'estafadora',
    'fraude',
    'lavado de dinero',
    'ilegal',
    'pornografía',
    'pornografia',
    'porno',
    'nude',
    'desnudo',
    'desnuda',
    'sexual',
    'sexo',
    'coca',
    'cocaina',
    'marihuana',
    'mota',
    'perico',
    'vicio',
    'vicioso',
    'viciosa',
];

function normalize(input: string): string {
    return input
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

/**
 * Busca una palabra prohibida dentro del texto. Retorna la palabra
 * prohibida encontrada o null si el texto es válido.
 */
export function findForbiddenWord(input: string): string | null {
    if (!input) {
        return null;
    }
    const normalized = normalize(input);
    const words = normalized.split(/[^a-z0-9]+/).filter(Boolean);
    for (const word of words) {
        if (FORBIDDEN_WORDS.includes(word)) {
            return word;
        }
    }
    // También busca coincidencia de subcadena para frases tipo "comerdemierda"
    for (const forbidden of FORBIDDEN_WORDS) {
        if (forbidden.includes(' ') && normalized.includes(forbidden)) {
            return forbidden;
        }
    }
    return null;
}

/**
 * Valida que el nombre de tienda no contenga palabras prohibidas.
 * Lanza un UserInputError (se muestra directo al vendedor) si lo encuentra.
 */
export function assertValidShopName(shopName: string): void {
    const forbidden = findForbiddenWord(shopName);
    if (forbidden) {
        throw new UserInputError(
            `Tu nombre de tienda contiene una palabra no permitida: "${forbidden}". Elige otro nombre.`,
        );
    }
}