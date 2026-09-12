# Imágenes pendientes

Esta pantalla se construyó sin fotografía real (no había ninguna licenciada
disponible en el repo). Los fondos actuales son gradientes/formas de marca,
igual que en la página pública `/es/sellers` (`infra/store`).

Cuando haya fotos reales, reemplazar así:

## `sections/HeroSection.tsx`
Fondo del hero (detrás del título y la tarjeta de login). Recomendado:
foto de un vendedor/producto colombiano, formato horizontal, ≥1600×900px.

1. Agregar el archivo a esta carpeta, p. ej. `hero-bg.jpg`.
2. En `HeroSection.tsx`, importar la imagen y añadir un `<img>` o
   `background-image` absoluto dentro de `<section id="ecommer-login-hero">`,
   por detrás del contenido (los divs de gradiente ya están en `-z-10`).

## Otras secciones
`AdminCapabilitiesSection`, `MiTiendaSection`, `EcosistemaSection` usan solo
íconos (`lucide-react`) hoy. Si se agregan capturas de pantalla reales del
Admin/Store, colocarlas aquí (`admin-preview.png`, `store-preview.png`,
≥800×600px) y reemplazar el ícono correspondiente por la imagen.

`SimetriaSection` ya usa un asset real (`simteria-avatar.png` del plugin
`ai-chat`) — no necesita nada nuevo.
