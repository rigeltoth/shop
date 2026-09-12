import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMapPicker, MapPickerSelection } from './GoogleMapPicker';

interface PickupAddressInputProps {
    googleMapsApiKey: string;
    value: string;
    selection: MapPickerSelection | null;
    onChange: (address: string) => void;
    onSelect: (selection: MapPickerSelection | null) => void;
    disabled?: boolean;
}

const GOOGLE_MAPS_SCRIPT_ID = 'ecommer-google-maps-places-script';

function getPlaceAddressComponent(place: any, componentTypes: string[]): string | null {
    const components = place?.address_components;
    if (!Array.isArray(components)) {
        return null;
    }

    const match = components.find((component: any) =>
        componentTypes.some(type => component.types?.includes(type)),
    );

    return match?.long_name || null;
}

function getNeighborhood(place: any): string | null {
    return getPlaceAddressComponent(place, [
        'neighborhood',
        'sublocality_level_1',
        'sublocality',
        'locality',
    ]);
}

/**
 * Campo de dirección de recogida con autocompletar de Google Maps y selector
 * en el mapa. Extraído del formulario de registro para reutilizarse en el wizard.
 */
export function PickupAddressInput({
    googleMapsApiKey,
    value,
    selection,
    onChange,
    onSelect,
    disabled = false,
}: PickupAddressInputProps) {
    const [mapsReady, setMapsReady] = useState(false);
    const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pickupInputRef = useRef<HTMLInputElement | null>(null);
    const autocompleteRef = useRef<any>(null);

    const hasPickupCoordinates =
        selection !== null &&
        Number.isFinite(selection.latitude) &&
        Number.isFinite(selection.longitude);

    const initializeAutocomplete = useCallback(() => {
        const maps = (window as any).google?.maps;
        if (!maps?.places || !pickupInputRef.current || autocompleteRef.current) {
            return;
        }

        autocompleteRef.current = new maps.places.Autocomplete(pickupInputRef.current, {
            componentRestrictions: { country: 'co' },
            fields: ['address_components', 'formatted_address', 'geometry', 'name', 'place_id'],
            types: ['geocode', 'establishment'],
        });

        autocompleteRef.current.addListener('place_changed', () => {
            const place = autocompleteRef.current.getPlace();
            const location = place?.geometry?.location;
            const latitude = typeof location?.lat === 'function' ? location.lat() : null;
            const longitude = typeof location?.lng === 'function' ? location.lng() : null;
            const address = place?.formatted_address || place?.name || value;

            if (!address || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                onSelect(null);
                setError('Selecciona una dirección válida desde Google Maps.');
                return;
            }

            const newSelection: MapPickerSelection = {
                address,
                latitude,
                longitude,
                neighborhood: getNeighborhood(place),
                postalCode: getPlaceAddressComponent(place, ['postal_code']),
                googlePlaceId: place?.place_id || null,
            };

            onChange(address);
            onSelect(newSelection);
            setError(null);
        });

        setMapsReady(true);
    }, [value]);

    useEffect(() => {
        if (!googleMapsApiKey) {
            setMapsReady(false);
            return;
        }

        if ((window as any).google?.maps?.places) {
            initializeAutocomplete();
            return;
        }

        let script = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;
        if (!script) {
            script = document.createElement('script');
            script.id = GOOGLE_MAPS_SCRIPT_ID;
            script.src =
                `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}` +
                '&libraries=places&language=es&region=CO';
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        }

        script.addEventListener('load', initializeAutocomplete);
        script.addEventListener('error', () => {
            setError('No se pudo cargar Google Maps. Revisa la API key configurada.');
        });

        return () => {
            script?.removeEventListener('load', initializeAutocomplete);
        };
    }, [googleMapsApiKey, initializeAutocomplete]);

    const handleInputChange = (next: string) => {
        onChange(next);
        setError(null);
    };

    const handleMapPickerSelect = (next: MapPickerSelection) => {
        onChange(next.address);
        onSelect(next);
        setError(null);
        setIsMapPickerOpen(false);
    };

    return (
        <div className="flex flex-col gap-1.5">
            <label
                htmlFor="pickupAddress"
                className="text-sm font-medium text-foreground"
            >
                Dirección de recogida *
            </label>
            <input
                ref={pickupInputRef}
                id="pickupAddress"
                type="text"
                value={value}
                onChange={e => handleInputChange(e.target.value)}
                placeholder="Busca la dirección de tu tienda"
                disabled={disabled || !googleMapsApiKey}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {mapsReady && (
                <button
                    type="button"
                    onClick={() => setIsMapPickerOpen(true)}
                    disabled={disabled}
                    className="self-start text-xs font-medium text-primary underline underline-offset-2 hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                    📍 Seleccionar ubicación en el mapa
                </button>
            )}
            {!googleMapsApiKey && (
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                    Configura GOOGLE_MAPS_API_KEY en el backend para seleccionar direcciones.
                </p>
            )}
            {googleMapsApiKey && !mapsReady && (
                <p className="text-xs text-muted-foreground">
                    Cargando buscador de Google Maps...
                </p>
            )}
            {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                    {error}
                </p>
            )}
            {hasPickupCoordinates && selection && (
                <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                    <p className="font-medium">Dirección seleccionada desde Google Maps</p>
                    <p className="mt-1 text-xs text-green-900">
                        {selection.address}
                    </p>
                    <p className="mt-1 text-xs">
                        {selection.neighborhood && (
                            <span>Barrio: {selection.neighborhood}. </span>
                        )}
                        Coordenadas: {selection.latitude.toFixed(6)}, {selection.longitude.toFixed(6)}
                    </p>
                    <a
                        href={`https://www.google.com/maps/search/?api=1&query=${selection.latitude},${selection.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex text-xs font-medium text-green-700 underline underline-offset-2 hover:text-green-900"
                    >
                        Ver en Google Maps
                    </a>
                </div>
            )}

            {isMapPickerOpen && (
                <GoogleMapPicker
                    initialLatitude={selection?.latitude}
                    initialLongitude={selection?.longitude}
                    onLocationSelect={handleMapPickerSelect}
                    onClose={() => setIsMapPickerOpen(false)}
                />
            )}
        </div>
    );
}