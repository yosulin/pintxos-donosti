# La Ruta del Pintxo — Donostia

Guía personal de bares de pintxos en San Sebastián. PWA estática, sin build step:
edita los JSON de `/data`, haz commit, y la web se actualiza sola (GitHub Pages).

**Live:** https://yosulin.github.io/pintxos-donosti/

## Interacción

- Cada bar es una tarjeta acordeón: toca el encabezado para ver dirección, horario, nota y el enlace a Maps.
- El círculo de la izquierda marca un bar como "probado" (se guarda en el propio navegador).
- "Cerca de mí" ordena cada zona por distancia, usando la ubicación del móvil.
- "Sorpréndeme" abre al azar uno de los imprescindibles.
- "Compartir" en cada tarjeta abre WhatsApp con la info del bar (dirección, especialidades, enlace a Maps y a la guía) ya redactada.
- Si no la tienes instalada, aparece un aviso para añadirla a la pantalla de inicio (prompt nativo en Android/Chrome, instrucciones manuales en iPhone).

## Estructura

```
index.html          esqueleto de la página (no hace falta tocarlo para añadir bares)
css/styles.css       estilos
js/app.js            carga los JSON y pinta la web
data/
  zones.json         barrios: id, etiqueta y color — se toca poco
  tiers.json         etiquetas de prioridad (3/2/1) — se toca poco
  bars.json          ⭐ la lista de bares — aquí se añade casi todo
manifest.json / sw.js   PWA (instalable, funciona offline)
icons/                iconos de la app
```

## Añadir un bar nuevo

Añade un objeto al array de `data/bars.json`. Campos:

| campo     | tipo            | obligatorio | notas                                              |
|-----------|-----------------|-------------|-----------------------------------------------------|
| `id`      | string          | sí          | único, en minúsculas con guiones                    |
| `zone`    | string          | sí          | debe existir en `zones.json` (`antiguo`/`centro`/`gros`, o uno nuevo) |
| `tier`    | número 1–3      | sí          | 3 = imprescindible, 2 = recomendado, 1 = si hay tiempo |
| `name`    | string          | sí          |                                                       |
| `addr`    | string          | sí          |                                                       |
| `hours`   | string          | no          | texto libre                                          |
| `tags`    | array de string | sí          | especialidades, se muestran como chips               |
| `note`    | string          | no          | frase corta destacada (tu comentario personal)       |
| `lat`,`lng` | número        | sí          | para el enlace a Google Maps                         |
| `placeId` | string          | no          | Place ID de Google, da un enlace más preciso          |
| `search`  | string          | no          | alternativa a `placeId` si no lo tienes: texto de búsqueda |

Ejemplo mínimo:

```json
{ "id":"nuevo-bar", "zone":"antiguo", "tier":2, "name":"Bar Nuevo",
  "addr":"Calle X, 1", "hours":"Todos los días 12:00–23:00",
  "tags":["Su especialidad"], "lat":43.3235, "lng":-1.9840 }
```

## Añadir un barrio/zona nuevo

Añade una entrada en `data/zones.json` con `label` y `color` (hex). Los filtros,
la lista y los contadores se generan solos a partir de ese archivo — no hace
falta tocar `js/app.js`.
