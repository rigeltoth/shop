import 'dotenv/config';

const ENVIA_TOKEN = process.env.ENVIA_TOKEN;
const ENVIA_ENV = process.env.ENVIA_ENV || 'sandbox';

const BASE_URL = ENVIA_ENV === 'production'
    ? 'https://api.envia.com'
    : 'https://api-test.envia.com';

async function main() {
    if (!ENVIA_TOKEN) {
        console.error('ENVIA_TOKEN no está definido');
        process.exit(1);
    }

    const body = {
        origin: {
            name: 'Tienda Steven',
            company: '',
            email: '',
            phone: '+573000000000',
            street: 'Calle 5',
            number: '10-20',
            city: '19001000',
            state: 'CAU',
            country: 'CO',
            postalCode: '19001000',
        },
        destination: {
            name: 'Cliente Cali',
            phone: '+573001234567',
            street: 'Calle 10',
            number: '',
            city: '76001000',
            state: 'VAC',
            country: 'CO',
            postalCode: '76001000',
        },
        packages: [
            {
                type: 'box',
                content: 'Productos',
                amount: 1,
                declaredValue: 50000,
                weight: 1,
                weightUnit: 'KG',
                lengthUnit: 'CM',
                dimensions: { length: 30, width: 20, height: 10 },
            },
        ],
        shipment: {
            type: 1,
            carrier: 'interRapidisimo',
            service: 'ground_small',
        },
        settings: {
            printFormat: 'PDF',
            printSize: 'STOCK_4X6',
        },
    };

    console.log(`POST ${BASE_URL}/ship/generate/`);
    console.log('Body:', JSON.stringify(body, null, 2));
    console.log('');

    try {
        const response = await fetch(`${BASE_URL}/ship/generate/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ENVIA_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const status = response.status;
        const responseBody = await response.text();

        console.log(`Status: ${status}`);
        console.log('');

        if (response.ok) {
            const data = JSON.parse(responseBody);
            const label = data.data?.[0];
            if (label) {
                console.log('Label creada exitosamente:');
                console.log(`  shipmentId:      ${label.shipmentId}`);
                console.log(`  trackingNumber:  ${label.trackingNumber}`);
                console.log(`  totalPrice:      ${label.totalPrice}`);
                console.log(`  trackUrl:        ${label.trackUrl}`);
                console.log(`  label (URL):     ${label.label}`);
            } else {
                console.log('Respuesta sin data[0]:', JSON.stringify(data, null, 2));
            }
        } else {
            console.error('Error response:');
            console.error(responseBody);
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Fetch error: ${message}`);
    }
}

main().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
