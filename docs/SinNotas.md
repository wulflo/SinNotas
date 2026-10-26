# SinNotas — guía técnica y estado

**Versión:** 0.2.8 · **Fecha:** 2026-10-26

SinNotas es una aplicación local de notas tipo outliner jerárquico. Las páginas
se guardan como Markdown dentro de una bóveda (vault). Tiene una aplicación de
escritorio completa y una APK Android centrada en el repaso de flashcards.

## Stack y estructura

- **Escritorio:** Tauri v2.
- **Backend y acceso a archivos:** Rust.
- **Interfaz:** TypeScript, HTML y CSS nativos; Vite para desarrollo y empaquetado.
- **Sin React ni Tailwind.**

Rutas principales:

| Ruta | Contenido |
| --- | --- |
| `src/desktop.ts` | Aplicación de escritorio, editor, ajustes, repaso y vistas. |
| `src/mobile/review-app.ts` | APK Android: repaso, edición de la tarjeta activa, ajustes y actualizador. |
| `src/editor/` | Modelo de bloques, parser Markdown, FSRS, oclusiones, historial y seguridad de URLs. |
| `src/views/` | Flashcards, grafo, kanban, listas virtuales y componentes de vista. |
| `src/store/` | Vault, búsqueda, progreso de repaso, selección de barra lateral y caché. |
| `src/services/` | Actualizador, utilidades de release y comprobaciones de integridad. |
| `src-tauri/src/` | Comandos Rust, sistema de archivos, caché, SAF y watcher. |
| `.github/workflows/` | CI, APK firmada y publicación de releases. |

## Funcionalidad esencial

- Editor outliner con bullets jerárquicos, arrastre, selección múltiple, atajos,
  deshacer/rehacer y snapshots.
- Los bullets de una misma jerarquía conservan la alineación aunque tengan
  propiedades; el indicador de propiedades usa el espacio del handle sin
  desplazar el bullet.
- Markdown con negritas, cursivas, subrayado, resaltado, wikilinks, etiquetas,
  tablas, imágenes y tarjetas Cloze.
- Flashcards básicas, Cloze y de oclusión de imagen con FSRS-4.5.
- Modo Aprendizaje de práctica: reinicia la cola con todas las tarjetas y no
  modifica el estado FSRS (`rate(..., persist=false)`).
- Kanban de tareas, grafo/mapa conceptual, historial de versiones y exportación.
- Interfaz en español, inglés y chino, temas claro/oscuro y varios acentos.
- Sincronización mediante el servicio de archivos que el usuario prefiera; la
  app no impone nube propia.

## FSRS y repaso

- FSRS-4.5 implementado en `src/editor/fsrs.ts`.
- Se usan los **17 pesos oficiales** de FSRS-4.5 (`ts-fsrs` 5.4.2), no una
  aproximación propia: `0.212, 1.2931, 2.3065, 11.2624, 4.4032, 1.2805, ...`.
- Fases de aprendizaje: pasos cortos de 1 min y 10 min antes de graduarse a
  repaso, para evitar intervalos iniciales irreales.
- El estado de aprendizaje se persiste; una tarjeta no vuelve a Review al
  recargar.
- En Learning/Relearning, **Easy** usa `nextRecallStability` en lugar de
  reiniciar a `S0(4)`.
- Los intervalos se muestran en unidades legibles: `m`, `h`, `d`, `mo`, `y`.
- El modo Aprendizaje no guarda progreso; al activarlo o desactivarlo la cola se
  reinicia con todas las tarjetas para que ninguna quede oculta.

## Oclusión de imagen

- Las tarjetas de oclusión guardan las regiones normalizadas (`x`, `y`, `width`,
  `height` entre 0 y 1) en la propiedad `image-occlusions::`.
- En la **pregunta** se ocultan todas las regiones. La región de la tarjeta
  activa se resalta para que el usuario sepa qué debe recordar.
- En la **respuesta** se muestra únicamente la imagen limpia: no se dibujan
  máscaras, contornos ni la región activa. Antes se volvían a pintar las demás
  regiones, un remanente de cuando se enseñaban a la vez la imagen con y sin
  oclusión.
- La vista previa de las tarjetas ajusta su caja al tamaño real de la imagen
  (`width: fit-content` y `img { width:auto; max-width:100% }`). Antes la imagen
  se dibujaba con `object-fit: contain` dentro de una caja más ancha, así que las
  máscaras se escalaban contra el espacio vacío y parecían desplazadas un ~5 %
  respecto de lo que el cursor marcó.
- Al guardar se recortan las regiones al lienzo, se aplica un tamaño mínimo y se
  redondean a 4 decimales en escritorio y Android. Así el dato guardado coincide
  con el gesto y no acumula ruido de coma flotante.
- El editor móvil y el de escritorio miden siempre contra el rectángulo real de
  la imagen (`getBoundingClientRect`), que es la misma referencia usada por el
  cursor.

## Selector de notas del repaso móvil

El selector **Repasar notas** de la APK ahora usa el mismo criterio que la
versión de escritorio:

- **20 notas por página**.
- Controles **Anterior / Siguiente** y contador `Página X de Y`.
- La búsqueda reinicia el paginado a la página 1.
- La selección en borrador se conserva al cambiar de página, buscar o marcar
  todas/ninguna.
- La página se pinta en **lotes de 8 filas por fotograma**; así cientos de notas
  no bloquean el WebView ni hacen colapsar el modal.
- Los cambios solo se aplican al pulsar **Aplicar selección**.

La lógica pura de paginado está en `src/mobile/notes-pagination.ts` y tiene
pruebas de regresión en `src/mobile/notes-pagination.test.ts`.

## Safe area en Android

La APK usa un puente nativo `SinNotasSafeArea` que combina `WindowInsets` con
`ViewCompat.getRootWindowInsets`. El frontend escucha los cambios y escribe las
variables CSS `--sinnotas-safe-area-*`, de modo que la barra de estado y la barra
de navegación no tapen el contenido.

La v0.2.3 corrige también el editor completo que se abre con **Abrir páginas y
editor**. Al montar esa superficie, `src/main.ts` vuelve a instalar el puente y
el CSS de `body.mobile-full-editor` aplica `--mobile-full-safe-*` a `.headbar`,
`.sidebar-left` y `.content-scroll`. La cabecera reserva la inset superior, el
cajón lateral respeta las cuatro insets y el contenido reserva la inferior; el
layout usa `100dvh` y deja que `.view-panel` crezca con flex. El modo repaso
conserva sus propias reglas en `src/mobile/mobile.css`.

El puente se inyecta con:

```bash
npm run android:patch
```

El script `scripts/patch-android-safe-area.mjs` se ejecuta después de
`tauri android init` y antes de compilar. CI siempre regenera `gen/android` y
vuelve a aplicar el parche.

## Bóveda en Android

La APK no abre el selector SAF ni pide permisos de almacenamiento. La bóveda
vive en el directorio privado de la aplicación:

```text
/data/data/com.sinnotas.desktop/files
```

Si ese directorio no se puede crear, se usa el almacenamiento externo específico
de la app (`/storage/emulated/0/Android/data/com.sinnotas.desktop/files`). El
arranque usa `app_data_dir()` y el botón **Abrir otra bóveda** devuelve la misma
raíz interna y la registra como autorizada, de modo que la app no vuelve a pedir
acceso ni confirmación en cada inicio.

Las bóvedas SAF de versiones anteriores siguen siendo legibles mientras el
sistema conserve el permiso, pero el flujo nuevo prioriza el almacenamiento
privado. Para respaldar o sincronizar, se usa la exportación de la app o una
copia de seguridad del sistema; el directorio interno no es visible desde el
gestor de archivos.

## Actualizador

### Escritorio

Usa el plugin nativo `updater` de Tauri. Verifica la firma minisign del paquete
y relanza la app. En Linux el manifiesto publica dos destinos:

- `linux-x86_64`: AppImage firmado. Lo usan las instalaciones AppImage.
- `linux-x86_64-deb`: `.deb` firmado con la misma clave. El plugin 2.14+ lo
  descarga, verifica la firma y lo instala con `pkexec`/`sudo`, pidiendo
  autorización. Lo usan las instalaciones Debian/Ubuntu.

La v0.2.2 es la primera release que anuncia `linux-x86_64-deb`. Por eso, una
instalación `.deb` de 0.2.0/0.2.1 debe instalar 0.2.2 manualmente una vez; a
partir de ahí las releases siguientes, como 0.2.3, se actualizan desde la app.
La firma que valida el updater es minisign, no una firma de paquete Debian.

### Android

El WebView no puede leer los assets de GitHub Releases por CORS. Por eso la APK
usa `@tauri-apps/plugin-http` para:

1. Descargar `latest.json` desde
   `https://github.com/wulflo/SinNotas/releases/latest/download/latest.json`.
2. Validar tamaño, JSON y esquema.
3. Descargar el APK de `android-aarch64`.
4. Verificar su SHA-256 contra el manifiesto.
5. Guardarlo temporalmente en la caché privada y copiarlo a
   `Descargas/SinNotas/` mediante MediaStore (`tauri-plugin-android-fs`).

Así el APK queda en el almacenamiento público de Descargas, visible para los
gestores de archivos y para el instalador de Android. No se usan permisos
legacy de almacenamiento: `minSdk 33` y MediaStore permiten escribir archivos
propios en Descargas. La instalación sigue siendo manual: la app no ejecuta ni
instala el APK.

El flujo se verificó en Android con 0.2.6 → 0.2.7: el APK quedó en
`Descargas/SinNotas/`, se abrió desde el gestor de archivos y se instaló
manualmente. Si MediaStore encuentra un nombre repetido, agrega un sufijo y la
interfaz muestra el nombre real del archivo.

**Fix 0.2.0/0.2.1:** GitHub sirve los assets de release como
`application/octet-stream`, incluso cuando el contenido es JSON. El código
anterior rechazaba cualquier `Content-Type` que no contuviera `json` y mostraba
*“La respuesta de GitHub no es un manifiesto JSON”*. Ahora no se valida esa
cabecera: mandan el límite de tamaño, `JSON.parse` y `parseReleaseManifest`.

La v0.2.0 ya instalada conserva el bug, así que hay que instalar la APK corregida
manualmente una vez. Después, el flujo de actualización funciona con releases
nuevas.

## Grafo y mapa conceptual

La vista de grafo usa un modelo de física de fuerzas propio con selección,
arrastre de nodos, paneo, zoom con rueda, doble clic para recentrar y reglas de
color por nombre. El revelado se hace por lotes para no congelar la interfaz.
El banco de pruebas interactivo está en `graph-harness.html`:

```bash
npm run dev
# abrir http://localhost:1420/graph-harness.html
```

Debe mostrar `HARNESS PASS`. Al tocar el grafo hay que ejecutar la suite y el
harness.

## Cache de metadatos y watcher

Las bóvedas locales guardan un índice binario (`.sinnotas_cache.bin`) para que
un arranque caliente solo procese notas nuevas o modificadas. Un watcher nativo
aplica cambios externos de forma incremental. El benchmark crea 5.000 notas y
compara arranque frío/caliente:

```bash
scripts/benchmark-cache.sh
# o: cargo run --release --manifest-path src-tauri/Cargo.toml --example cache_benchmark -- 5000
```

## Seguridad

- Las operaciones de archivos se limitan a la bóveda activa.
- `resolve_vault_path` rechaza `..`, rutas absolutas fuera de la raíz, bytes NUL,
  symlinks que escapan de la bóveda y URIs `content://`, `file://` o `http://`.
- El portapapeles pasa por una lista blanca; nunca se inyecta HTML crudo.
- La CSP solo permite `self` e IPC. Las descargas las hacen plugins nativos.
- Android no pide permisos de almacenamiento ni `REQUEST_INSTALL_PACKAGES`.
- `allowBackup=false` en el manifiesto Android.
- La APK release se firma con la clave de release; los secretos solo existen en
  el paso de firma de CI.
- El actualizador Android verifica SHA-256 antes de ofrecer el archivo.

## Rendimiento

- Caché binaria de metadatos (`.sinnotas_cache.bin`) para arranques calientes.
- Watcher nativo para cambios externos.
- Escaneo de flashcards por lotes con caché y cancelación.
- Listas virtuales para grandes volúmenes.
- Grafo con revelado por lotes y física estable.
- Selector de notas móvil paginado y con render escalonado.

## Requisitos y comandos

- Node.js 22.12 o superior.
- Rust estable.
- JDK 17 o superior para Android.
- Android SDK/NDK para compilar la APK.

```bash
npm install
npm run dev
npm test
npx tsc --noEmit
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

### Build Android local

```bash
npm ci
npm run tauri android init -- --ci
npm run android:patch
npm run tauri icon src-tauri/icons/icon-manifest.json
VITE_APP_MODE=flashcards npm run tauri android build -- --apk --debug --target aarch64
```

No hace falta Android Studio: con SDK/NDK, build-tools y un JDK alcanza. La APK
debug se firma con la clave debug y no puede actualizar una release firmada con
la clave de release.

### CI y publicación

- `.github/workflows/ci.yml`: lint/test, APK debug y APK release firmada en
  `master` o por `workflow_dispatch`. Publica artefactos, no crea releases.
- `.github/workflows/release.yml`: se dispara con tags `v*`, genera los paquetes
  de escritorio, la APK, `latest.json` y publica la release. El job Linux firma
  además el `.deb` con `tauri signer sign --app-version` y sube `.deb.sig`.
- `scripts/prepare-release-assets.mjs` exige `linux-x86_64-deb` y falla si
  falta el `.deb` o su firma, igual que con el resto de plataformas.
- El `latest.json` se genera y publica solo desde el workflow de release; un
  artefacto local de CI no actualiza el manifiesto.
- Secretos de firma Android: `ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`,
  `KEY_PASSWORD`, `KEY_ALIAS`.
- Secretos del updater de escritorio: `TAURI_SIGNING_PRIVATE_KEY`,
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

### Publicar una release sin errores

El workflow de release se dispara **solo** con un tag que empiece por `v` y
compara el número del tag con tres archivos. Para publicar la `0.2.8`:

```bash
# 1. Las tres versiones deben ser idénticas
node -p "require('./package.json').version"
node -p "require('./src-tauri/tauri.conf.json').version"
sed -n 's/^version[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' src-tauri/Cargo.toml | head -n 1

# 2. Commit y tag anotado sobre ese commit
git add -A
git commit -m "chore(release): preparar 0.2.8"
git tag -a v0.2.8 -m "Sin Notas 0.2.8"     # el tag SIEMPRE lleva la v

# 3. Empujar y comprobar que arrancó el workflow
git push origin master
git push origin v0.2.8
gh run list --workflow=release.yml --limit 1
```

Puntos que causan el error de “número de release distinto” o `already_exists`:

- **El tag no lleva `v`.** Un tag `0.2.8` no dispara `release.yml` (filtro
  `v*`), así que GitHub guarda una release sin artefactos y `latest.json`
  devuelve 404.
- **El tag no coincide con las tres versiones.** El job `validate` falla antes
  de compilar. El número de `latest.json` se genera sin la `v`; no se debe
  escribir a mano.
- **La release se creó o guardó antes en la interfaz web.** Al pulsar
  *Save release* GitHub crea el tag en el commit que elija la UI, no en el
  commit local. Después, el workflow intenta publicar sobre un tag que ya
  apunta a otro sitio y falla con `already_exists` o con una release vacía.
  La release se crea **solo** dejando que el workflow la genere desde el tag.
- **Se reutiliza un tag viejo.** Si el tag ya existe en otro commit, hay que
  borrarlo en local y en remoto, volver a crearlo sobre el commit correcto y
  empujarlo con `--force`. Nunca se edita una release a mano para “arreglar”
  el número.

En la primera publicación de la v0.2.8 el tag se empujó junto con `master` y
GitHub no inició el workflow de Release; no se pudo confirmar la causa. Se
resolvió borrando el tag remoto y volviéndolo a crear sobre el commit correcto.
La comprobación con `gh run list --workflow=release.yml` es obligatoria después
de cada push: si no aparece el run, se borra el tag remoto, se vuelve a crear
sobre el commit correcto y se empuja de nuevo.

## Datos de la release Android

- Paquete: `com.sinnotas.desktop`
- Versión actual: `0.2.8` (`versionCode 2008`)
- `minSdk 33`, `targetSdk 37`
- Arquitectura: `arm64-v8a`
- Firma release esperada (SHA-256 del certificado):
  `fd3aa8bff77d23bfad24fc4a0c6eb50cdfa3f822611e4ea6a12b78ddcee25b2c`
- DN: `CN=Sin Notas, OU=Android, O=SinNotas, L=Bogota, ST=Bogota, C=CO`

## Limitaciones conocidas

- Las bóvedas externas en Android dependen del acceso SAF autorizado por el
  usuario; no se interpretan URIs como rutas locales. La v0.2.8 usa el
  directorio privado de la app para la bóveda y no abre el diálogo SAF.
- La APK abre en modo repaso. El editor completo, con diarios, Kanban, grafo y
  mapa conceptual, se abre desde **Abrir páginas y editor**.
- El fix de safe area del editor completo se validó con estilos computados en el
  navegador; falta confirmarlo en un dispositivo Android real.
- La actualización automática de `.deb` no se probó de extremo a extremo en
  hardware real: requiere `pkexec`/`sudo` y una instalación 0.2.2 previa.

## Compatibilidad con versiones antiguas

- Una app v0.2.0 instalada no puede autoactualizarse por el bug del
  `Content-Type`; requiere instalar la APK corregida manualmente una vez.
- Una instalación `.deb` de 0.2.0/0.2.1 debe instalar 0.2.2 manualmente una vez;
  desde 0.2.2 el updater ya puede descargar e instalar el `.deb`.

## Verificación actual

- `npx tsc --noEmit`: correcto.
- `npm test`: **249 pruebas en 27 archivos**; incluye los pesos oficiales de
  FSRS-4.5 y las regresiones de oclusión.
- `cargo check --manifest-path src-tauri/Cargo.toml --lib`: correcto.
- CI de `master`: lint/test, APK debug y APK release firmada.
- Safe area del editor completo: estilos computados en navegador con inset
  superior 24 px e inferior 16 px; `.headbar` mide 72 px, el cajón lateral y el
  contenido reservan sus insets y el layout encaja en el viewport.
- Release v0.2.3: APK `versionName 0.2.3` / `versionCode 2003`, firmas v3,
  `.deb.sig` y `latest.json` verificados; las URLs de AppImage, `.deb`, Windows,
  macOS y Android devuelven 200. Las firmas minisign del AppImage y del `.deb`
  se validaron contra la clave pública del updater.
- Release v0.2.6: APK `versionName 0.2.6` / `versionCode 2006`; el SHA-256 del
  APK coincide con `latest.json`, las URLs devuelven 200 y las firmas minisign
  del AppImage y del `.deb` se validaron contra la clave pública del updater.
- Release v0.2.7: APK `versionName 0.2.7` / `versionCode 2007`; el SHA-256 del
  APK coincide con `latest.json`, las URLs devuelven 200, las firmas minisign
  del AppImage y del `.deb` se validaron y el certificado Android es el mismo
  que el de 0.2.6.
- Release v0.2.8: publicada como *latest*; APK `versionName 0.2.8` /
  `versionCode 2008`, paquete `com.sinnotas.desktop`, `minSdk 33` y
  `targetSdk 37`. El SHA-256 del APK
  (`54e47dfe23d9151a3a65941ba279e948281f416aa62bf00fa66de8f72f5c3a35`)
  coincide con `latest.json`; `latest.json` declara `version: "0.2.8"` e incluye
  Linux (`AppImage` y `.deb`), Windows, macOS universal y Android. Las descargas
  de `latest.json` y del APK devuelven 200. En local, los pesos oficiales de
  FSRS-4.5 están aplicados, las 249 pruebas y `tsc --noEmit` pasan, la respuesta
  de oclusión ya no dibuja máscaras y la vista previa ajusta su caja al tamaño
  real de la imagen.
- Oclusión de imagen, medición en navegador: con el CSS anterior una imagen
  vertical 400×1200 dejaba la caja de la máscara un **72,1 %** más ancha que la
  imagen visible; con `width: fit-content` y la imagen en `width: auto` la caja,
  la imagen y la capa de máscaras coinciden al píxel (0 % de desajuste).
- Actualización Android 0.2.6 → 0.2.7: APK guardado en `Descargas/SinNotas/`,
  visible desde el gestor de archivos e instalado manualmente.
- Alineación de bullets con propiedades: verificada en navegador midiendo la
  posición horizontal de los bullets; todos coinciden dentro de la misma
  jerarquía.
- El generador de `latest.json` normaliza los espacios de los assets a puntos,
  igual que GitHub, para que las URLs publicadas coincidan con los nombres
  reales de los archivos.

## Política de documentación

Toda la documentación técnica y de estado vive en este único archivo:
`docs/SinNotas.md`. El README de la raíz es el punto de entrada y enlaza aquí.
