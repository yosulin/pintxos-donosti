# La Ruta del Pintxo — Donostia

Guía personal de bares de pintxos en San Sebastián. PWA estática, sin build step:
edita los JSON de `/data`, haz commit, y la web se actualiza sola (GitHub Pages).

**Live:** https://yosulin.github.io/pintxos-donosti/

## Estructura

```
index.html          esqueleto de la página (no hace falta tocarlo para añadir bares)
css/styles.css       estilos
js/app.js            carga los JSON y pinta la web
data/
  zones.json         barrios: id, etiqueta y color — se toca poco
  tiers.json         etiquetas de prioridad (3/2/1) — se toca poco
  bars.json          ⭐ la lista de bares — aquí se añade casi todo
  night.json         planes nocturnos por franja horaria
  special.json        sitios "de capricho" fuera de la ruta normal (ej. Akelarre)
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
el grid y los contadores se generan solos a partir de ese archivo — no hace
falta tocar `js/app.js`.

## Planes nocturnos y sitios especiales

`night.json` es un array de franjas horarias, cada una con su lista de sitios.
`special.json` es un array de tarjetas destacadas (hoy solo Akelarre) — puedes
añadir más sitios "de capricho" del mismo modo.
