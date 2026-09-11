import 'dotenv/config';
import { Pool } from 'pg';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

interface AdminRow {
    id: string;
    firstName: string;
    lastName: string;
    emailAddress: string;
    customFieldsStorepickuplatitude: number | null;
    customFieldsStorepickuplongitude: number | null;
    customFieldsStorepickupaddress: string | null;
    customFieldsStorepickuppostalcode: string | null;
}

function extractPostalCode(components: Array<{ long_name: string; types: string[] }>): string | null {
    const match = components.find(comp => comp.types.includes('postal_code'));
    return match?.long_name ?? null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
        console.error(`Geocoding API HTTP ${response.status} para lat=${lat} lng=${lng}`);
        return null;
    }

    const data = await response.json() as {
        status: string;
        results?: Array<{ address_components?: Array<{ long_name: string; types: string[] }> }>;
    };

    if (data.status !== 'OK' || !data.results?.length) {
        console.error(`Geocoding API status=${data.status} para lat=${lat} lng=${lng}`);
        return null;
    }

    for (const result of data.results) {
        if (result.address_components) {
            const code = extractPostalCode(result.address_components);
            if (code) return code;
        }
    }

    return null;
}

async function forwardGeocode(address: string): Promise<string | null> {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
        console.error(`Geocoding API HTTP ${response.status} para address="${address.substring(0, 60)}..."`);
        return null;
    }

    const data = await response.json() as {
        status: string;
        results?: Array<{ address_components?: Array<{ long_name: string; types: string[] }> }>;
    };

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error(`Geocoding API status=${data.status} para address="${address.substring(0, 60)}..."`);
        return null;
    }

    if (!data.results?.length) {
        return null;
    }

    for (const result of data.results) {
        if (result.address_components) {
            const code = extractPostalCode(result.address_components);
            if (code) return code;
        }
    }

    return null;
}

async function main() {
    if (!DATABASE_URL) {
        console.error('DATABASE_URL no está definida');
        process.exit(1);
    }

    if (!GOOGLE_MAPS_API_KEY) {
        console.error('GOOGLE_MAPS_API_KEY no está definida');
        process.exit(1);
    }

    const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

    try {
        const { rows: coordRows } = await pool.query<AdminRow>(`
            SELECT
                id,
                "firstName",
                "lastName",
                "emailAddress",
                "customFieldsStorepickuplatitude",
                "customFieldsStorepickuplongitude",
                "customFieldsStorepickupaddress",
                "customFieldsStorepickuppostalcode"
            FROM administrator
            WHERE "customFieldsStorepickuplatitude" IS NOT NULL
              AND "customFieldsStorepickuplongitude" IS NOT NULL
              AND ("customFieldsStorepickuppostalcode" IS NULL OR "customFieldsStorepickuppostalcode" = '')
        `);

        let coordUpdated = 0;
        let coordFailed = 0;
        const coordProcessedIds = new Set<string>();

        for (let i = 0; i < coordRows.length; i++) {
            const row = coordRows[i];
            const lat = row.customFieldsStorepickuplatitude!;
            const lng = row.customFieldsStorepickuplongitude!;

            try {
                const postalCode = await reverseGeocode(lat, lng);

                if (postalCode) {
                    await pool.query(
                        `UPDATE administrator SET "customFieldsStorepickuppostalcode" = $1 WHERE id = $2`,
                        [postalCode, row.id],
                    );
                    coordUpdated++;
                    coordProcessedIds.add(row.id);
                } else {
                    coordFailed++;
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(`Error reverse geocode (id=${row.id}): ${message}`);
                coordFailed++;
            }

            await new Promise(resolve => setTimeout(resolve, 200));
        }

        const { rows: addressRows } = await pool.query<AdminRow>(`
            SELECT
                id,
                "firstName",
                "lastName",
                "emailAddress",
                "customFieldsStorepickuplatitude",
                "customFieldsStorepickuplongitude",
                "customFieldsStorepickupaddress",
                "customFieldsStorepickuppostalcode"
            FROM administrator
            WHERE "customFieldsStorepickupaddress" IS NOT NULL
              AND "customFieldsStorepickupaddress" != ''
              AND ("customFieldsStorepickuppostalcode" IS NULL OR "customFieldsStorepickuppostalcode" = '')
        `);

        const remainingRows = addressRows.filter(r => !coordProcessedIds.has(r.id));

        let addressUpdated = 0;
        let addressFailed = 0;

        for (let i = 0; i < remainingRows.length; i++) {
            const row = remainingRows[i];
            const address = row.customFieldsStorepickupaddress!;

            try {
                const postalCode = await forwardGeocode(address);

                if (postalCode) {
                    await pool.query(
                        `UPDATE administrator SET "customFieldsStorepickuppostalcode" = $1 WHERE id = $2`,
                        [postalCode, row.id],
                    );
                    addressUpdated++;
                } else {
                    addressFailed++;
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(`Error forward geocode (id=${row.id}): ${message}`);
                addressFailed++;
            }

            await new Promise(resolve => setTimeout(resolve, 200));
        }

        const { rows: noLocationRows } = await pool.query<AdminRow>(`
            SELECT
                id,
                "firstName",
                "lastName",
                "emailAddress"
            FROM administrator
            WHERE ("customFieldsStorepickuplatitude" IS NULL OR "customFieldsStorepickuplatitude" = 0)
              AND ("customFieldsStorepickuplongitude" IS NULL OR "customFieldsStorepickuplongitude" = 0)
              AND ("customFieldsStorepickupaddress" IS NULL OR "customFieldsStorepickupaddress" = '')
        `);

        console.log(`Reverse geocode (lat/lng): ${coordRows.length} procesados, ${coordUpdated} actualizados, ${coordFailed} fallidos`);
        console.log(`Forward geocode (dirección): ${remainingRows.length} procesados, ${addressUpdated} actualizados, ${addressFailed} fallidos`);

        if (noLocationRows.length > 0) {
            console.log(`Vendedores sin ningún dato de ubicación (${noLocationRows.length}):`);
            for (const row of noLocationRows) {
                const name = `${row.firstName} ${row.lastName}`.trim() || '(sin nombre)';
                console.log(`  - ${name} (${row.emailAddress || 'sin email'})`);
            }
        }
    } finally {
        await pool.end();
    }
}

main().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
