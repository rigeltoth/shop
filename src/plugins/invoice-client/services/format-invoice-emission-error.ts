/**
 * Extrae un mensaje legible del fallo al emitir factura (axios / micro / Matias).
 * Evita persistir solo "Request failed with status code 500".
 */

function stringifyDetails(details: unknown): string | null {
  if (details == null) return null;
  if (typeof details === 'string' && details.trim()) return details.trim();
  if (Array.isArray(details)) {
    const parts = details
      .map((d) => {
        if (typeof d === 'string') return d;
        if (d && typeof d === 'object') {
          const o = d as { property?: string; constraints?: Record<string, string>; message?: string };
          if (o.message) return o.message;
          if (o.constraints) {
            const vals = Object.values(o.constraints).filter(Boolean);
            if (vals.length) {
              return o.property ? `${o.property}: ${vals.join('; ')}` : vals.join('; ');
            }
          }
        }
        return null;
      })
      .filter((x): x is string => !!x);
    return parts.length ? parts.join(' · ') : null;
  }
  if (typeof details === 'object') {
    const o = details as { string?: string[] | string; message?: string };
    if (Array.isArray(o.string) && o.string.length) return o.string.join(' · ');
    if (typeof o.string === 'string' && o.string.trim()) return o.string.trim();
    if (typeof o.message === 'string' && o.message.trim()) return o.message.trim();
    try {
      const s = JSON.stringify(details);
      return s.length > 2 && s.length <= 400 ? s : null;
    } catch {
      return null;
    }
  }
  return null;
}

function httpStatusHint(status: number | undefined): string | null {
  if (status == null) return null;
  if (status === 400) {
    return 'Los datos enviados a facturación no son válidos.';
  }
  if (status === 401 || status === 403) {
    return 'El servicio de facturación rechazó la autenticación (API key o token Matias).';
  }
  if (status === 402) {
    return 'Se alcanzó el límite de documentos en Matias. Revisa el cupo del paquete en Matias.';
  }
  if (status === 404) {
    return 'No se encontró el recurso de facturación solicitado.';
  }
  if (status === 408 || status === 504) {
    return 'Tiempo de espera agotado al contactar Matias o el servicio de facturación.';
  }
  if (status === 429) {
    return 'Demasiadas solicitudes a Matias. Espera un momento e intenta de nuevo.';
  }
  if (status >= 500) {
    return `El servicio de facturación respondió con error HTTP ${status}.`;
  }
  if (status >= 400) {
    return `Error HTTP ${status} al emitir la factura.`;
  }
  return null;
}

/**
 * Convierte mensajes técnicos ya guardados (o crudos) en texto comprensible para el vendedor.
 */
export function humanizeInvoiceEmissionError(raw: string): string {
  const text = (raw ?? '').trim();
  if (!text) {
    return 'No se pudo emitir la factura. Motivo desconocido.';
  }

  const statusMatch = /Request failed with status code (\d+)/i.exec(text);
  if (statusMatch) {
    const hint = httpStatusHint(parseInt(statusMatch[1], 10));
    return hint
      ? `${hint} Revisa Company ID, prefijo, resolución y que el microservicio esté en línea.`
      : text;
  }

  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network error/i.test(text)) {
    return 'No se pudo conectar con el servicio de facturación. Verifica que el microservicio esté en marcha.';
  }

  if (/Validation failed/i.test(text)) {
    return text.length > 20
      ? text
      : 'Faltan datos obligatorios para emitir la factura (cliente, resolución, prefijo, etc.).';
  }

  if (/property ["']?image["']? on null|InvoiceReports\.php/i.test(text)) {
    return (
      'Matias no pudo generar el PDF de la factura: falta el logo (image) de la empresa en Matias. ' +
      'En el panel sandbox de Matias, abre esa compañía (Company ID / client_uuid) y sube el logo de la empresa; ' +
      'luego vuelve a emitir. Si ya tiene logo, contacta soporte Matias (error en InvoiceReports.php).'
    );
  }

  if (/ya se encuentra validado/i.test(text)) {
    return (
      'Matias indica que ese consecutivo de factura ya fue validado (p. ej. FEV1). ' +
      'Suele pasar si un intento anterior llegó a DIAN pero falló el PDF/logo. ' +
      'El sistema reintenta con el siguiente número automáticamente; si persiste, en Matias ' +
      'avanza el «siguiente consecutivo» de la resolución FEV o contacta soporte Matias.'
    );
  }

  if (/resoluci[oó]n de facturaci[oó]n activa/i.test(text)) {
    return (
      'Matias no encontró una resolución DIAN activa para el prefijo y número configurados en «Matias por tienda». ' +
      'Revisa en el panel sandbox de Matias que la resolución esté vigente para la fecha de hoy, que el prefijo (ej. FEV) ' +
      'y el número de resolución coincidan exactamente con los de esa compañía (Company ID), y que no haya vencido ' +
      '(en sandbox las resoluciones de prueba suelen tener vigencia corta).'
    );
  }

  if (/fecha\s*\([^)]+\)\s*del documento debe estar entre/i.test(text)) {
    return (
      'Matias rechazó la factura porque la fecha del documento no coincide con el día de emisión en Colombia. '
    );
  }

  let cleaned = text
    .replace(/^Failed to create invoice in Matias:\s*/i, 'Matias rechazó la factura: ')
    .replace(/^Failed to create invoice:\s*/i, 'No se pudo crear la factura: ')
    .replace(/^Failed to authenticate with Matias:\s*/i, 'No se pudo autenticar con Matias: ')
    .replace(/^Error:\s*/i, '')
    .trim();

  if (/^Http Status \d+$/i.test(cleaned) || /^\d{3}$/.test(cleaned)) {
    const code = parseInt(/\d{3}/.exec(cleaned)?.[0] ?? '', 10);
    return (
      httpStatusHint(code) ??
      `Error HTTP ${code} al emitir la factura. Contacta soporte si persiste.`
    );
  }

  if (cleaned.length > 500) {
    cleaned = `${cleaned.slice(0, 497)}…`;
  }
  return cleaned;
}

/**
 * Lee un error de axios / Error y produce el texto a persistir en `invoiceLastError`.
 */
export function formatInvoiceEmissionError(error: unknown): string {
  const ax = error as {
    message?: string;
    code?: string;
    response?: {
      status?: number;
      data?: {
        message?: string;
        error?: string;
        details?: unknown;
      };
    };
  };

  const status = ax.response?.status;
  const data = ax.response?.data;
  const detailStr = stringifyDetails(data?.details);

  const candidates = [
    data?.message,
    typeof data?.error === 'string' && data.error !== 'Error' ? data.error : null,
    detailStr,
    ax.message,
  ]
    .map((c) => (typeof c === 'string' ? c.trim() : ''))
    .filter(Boolean);

  let combined = candidates[0] ?? '';
  if (detailStr && combined && !combined.includes(detailStr) && combined === data?.message) {
    combined = `${combined} (${detailStr})`;
  }

  if (!combined && status) {
    combined = `Request failed with status code ${status}`;
  }

  if (!combined && ax.code) {
    combined = String(ax.code);
  }

  if (!combined && error instanceof Error) {
    combined = error.message;
  }

  if (!combined) {
    combined = String(error ?? 'Unknown error');
  }

  return humanizeInvoiceEmissionError(combined);
}
