import { useCallback, useEffect, useRef, useState } from 'react';

export type MapPickerSelection = {
    address: string;
    latitude: number;
    longitude: number;
    neighborhood: string | null;
    postalCode: string | null;
    googlePlaceId: string | null;
};

interface GoogleMapPickerProps {
    initialLatitude?: number;
    initialLongitude?: number;
    onLocationSelect: (selection: MapPickerSelection) => void;
    onClose: () => void;
    defaultCenter?: { lat: number; lng: number };
}

function getGeocodeAddressComponent(
    components: Array<{ long_name: string; short_name: string; types: string[] }> | undefined,
    types: string[],
): string | null {
    const match = components?.find(component =>
        types.some(type => component.types?.includes(type)),
    );
    return match?.long_name || null;
}

export function GoogleMapPicker({
    initialLatitude,
    initialLongitude,
    onLocationSelect,
    onClose,
    defaultCenter = { lat: 2.4419, lng: -76.6063 }, // Popayán, Cauca por defecto
}: GoogleMapPickerProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const geocoderRef = useRef<any>(null);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(
        Number.isFinite(initialLatitude) && Number.isFinite(initialLongitude)
            ? { lat: initialLatitude as number, lng: initialLongitude as number }
            : null,
    );
    const [address, setAddress] = useState('');
    const [loadError, setLoadError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);

    const reverseGeocode = useCallback((position: { lat: number; lng: number }) => {
        if (!geocoderRef.current) return;
        geocoderRef.current.geocode(
            { location: position },
            (results: any[], status: string) => {
                if (status === 'OK' && results?.[0]) {
                    setAddress(results[0].formatted_address || '');
                } else {
                    setAddress(`${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`);
                }
            },
        );
    }, []);

    useEffect(() => {
        const maps = (window as any).google?.maps;
        const container = mapContainerRef.current;
        if (!maps || !container) {
            setLoadError('Google Maps no está disponible. Revisa la API key configurada.');
            return;
        }

        const center = selectedLocation || defaultCenter;
        mapRef.current = new maps.Map(container, {
            center,
            zoom: selectedLocation ? 17 : 13,
            clickableIcons: false,
            fullscreenControl: false,
            mapTypeControl: true,
            streetViewControl: false,
            gestureHandling: 'greedy',
        });
        geocoderRef.current = new maps.Geocoder();

        const placeMarker = (position: { lat: number; lng: number }) => {
            if (markerRef.current) {
                markerRef.current.setPosition(position);
            } else {
                markerRef.current = new maps.Marker({
                    map: mapRef.current,
                    position,
                    draggable: true,
                    animation: maps.Animation.DROP,
                });
                markerRef.current.addListener('dragend', (event: any) => {
                    const dragged = {
                        lat: event.latLng.lat(),
                        lng: event.latLng.lng(),
                    };
                    setSelectedLocation(dragged);
                    reverseGeocode(dragged);
                });
            }
        };

        if (selectedLocation) {
            placeMarker(selectedLocation);
            reverseGeocode(selectedLocation);
        }

        mapRef.current.addListener('click', (event: any) => {
            const clicked = {
                lat: event.latLng.lat(),
                lng: event.latLng.lng(),
            };
            placeMarker(clicked);
            setSelectedLocation(clicked);
            reverseGeocode(clicked);
        });

        return () => {
            markerRef.current?.setMap?.(null);
            markerRef.current = null;
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleConfirm = useCallback(() => {
        if (!selectedLocation) {
            return;
        }

        if (!geocoderRef.current) {
            onLocationSelect({
                address: address || `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`,
                latitude: selectedLocation.lat,
                longitude: selectedLocation.lng,
                neighborhood: null,
                postalCode: null,
                googlePlaceId: null,
            });
            return;
        }

        setConfirming(true);
        geocoderRef.current.geocode(
            { location: selectedLocation },
            (results: any[], status: string) => {
                setConfirming(false);
                if (status === 'OK' && results?.[0]) {
                    const place = results[0];
                    onLocationSelect({
                        address:
                            place.formatted_address ||
                            `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`,
                        latitude: selectedLocation.lat,
                        longitude: selectedLocation.lng,
                        neighborhood: getGeocodeAddressComponent(place.address_components, [
                            'neighborhood',
                            'sublocality_level_1',
                            'sublocality',
                            'locality',
                        ]),
                        postalCode: getGeocodeAddressComponent(place.address_components, [
                            'postal_code',
                        ]),
                        googlePlaceId: place.place_id || null,
                    });
                } else {
                    onLocationSelect({
                        address: address || `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`,
                        latitude: selectedLocation.lat,
                        longitude: selectedLocation.lng,
                        neighborhood: null,
                        postalCode: null,
                        googlePlaceId: null,
                    });
                }
            },
        );
    }, [selectedLocation, address, onLocationSelect]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-3xl bg-background rounded-xl shadow-2xl overflow-hidden border border-border">
                <div className="flex items-start justify-between px-5 py-4 border-b border-border">
                    <div>
                        <h3 className="text-base font-semibold text-foreground">
                            Seleccionar ubicación en el mapa
                        </h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Haz clic en el mapa o arrastra el marcador para seleccionar tu ubicación
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar"
                        className="ml-4 rounded-md px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                        ✕
                    </button>
                </div>

                <div className="relative">
                    <div
                        ref={mapContainerRef}
                        className="w-full h-[420px] bg-muted"
                        aria-label="Mapa para seleccionar ubicación"
                    />
                    {loadError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/90">
                            <p className="text-sm text-destructive max-w-md px-4 text-center">{loadError}</p>
                        </div>
                    )}
                </div>

                <div className="px-5 py-4 border-t border-border">
                    {selectedLocation && address && (
                        <div className="mb-3 rounded-md border border-border bg-muted/30 px-3 py-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Dirección seleccionada:
                            </p>
                            <p className="text-sm font-medium text-foreground mt-0.5">{address}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Coordenadas: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                            </p>
                        </div>
                    )}
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={!selectedLocation || confirming}
                            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {confirming ? 'Confirmando...' : 'Confirmar ubicación'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
