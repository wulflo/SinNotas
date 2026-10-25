# Diagnóstico del job "Build Android Release APK (signed)"

> **Nota de vigencia (2026-10-24):** Esta bitácora corresponde a **fases previas**
> del desarrollo y **no representa el estado actual de la CI**. Los fallos aquí
> descritos ya fueron corregidos y el job de release quedó en verde; la última
> ejecución validada fue
> [40084817452](https://github.com/wulflo/SinNotas/actions/runs/40084817452),
> que generó y subió la APK firmada. Se conserva como registro histórico del
> diagnóstico; para el estado vigente, consultar las ejecuciones más recientes.

Bitácora de las ejecuciones de CI usadas para dejar en verde el APK release
firmado mediante `workflow_dispatch` (sin crear releases ni tags).

## Ejecuciones

| Intento | Run ID / URL | Paso fallido | Causa raíz | Cambio aplicado | Resultado |
| --- | --- | --- | --- | --- | --- |
| 1 | [40051966533](https://github.com/wulflo/SinNotas/actions/runs/40051966533) | `Build release APK (unsigned)` | `tauri-plugin-android-fs` 2.0.1 compila con `compileSdk = 34`; `tauri-android` 2.12.4 exige API 36 (`checkReleaseAarMetadata`) | Alinear `compileSdk` del plugin a 36 en el registry de Cargo, antes del build | Fallido (1 error causal corregido) |
| 2 | [40052964001](https://github.com/wulflo/SinNotas/actions/runs/40052964001) | — (sin fallos) | — | — | **Verde**: APK arm64 firmado, chequeos de manifest OK, artefacto `SinNotas-ci-fix-signed-apk` subido. El resumen no mostró la huella: build-tools 37 usa otro formato de `apksigner` |
| 3 | [40053883124](https://github.com/wulflo/SinNotas/actions/runs/40053883124) | — (sin fallos) | — | Parser de huella compatible con build-tools 37 | **Verde** y artefacto `SinNotas-ci-fix-signed-apk` subido. Resumen con huella; validación local del APK completa |
| 4 | [40054354927](https://github.com/wulflo/SinNotas/actions/runs/40054354927) | — (sin fallos) | — | Validación final sobre el HEAD `3e3cf63` | **Verde**; APK idéntico (mismo SHA-256) y artefacto subido |
| 5 | [40054969678](https://github.com/wulflo/SinNotas/actions/runs/40054969678) | — (sin fallos) | — | Añadir `zipalign -c -v 4` y `apksigner verify --verbose` al job | **Verde** sobre el HEAD `4c31e41`; alineación y firma v3 verificadas |

## Notas de diagnóstico

- El job aparecía **skipped**, no fallido, porque su `if` exigía
  `github.event_name == 'push'` y un tag `v*`, y las ejecuciones previas eran
  pushes a `master`.
- El fallo del intento 1 es de la categoría (b) Gradle/dependencias: no es un
  problema de firma ni del parche del manifest.
- El job de debug compila con la misma dependencia, pero el chequeo de AAR
  metadata que falla corresponde al variante `release`.
- `tauri-plugin-android-fs` 30.2.0 ya usa API 36, pero cambia la API pública de
  Rust (`AndroidFs` pasa a struct genérica y desaparecen los `convert_*`), por
  lo que migrarlo requeriría cambiar la lógica de la app.

## Validación del APK de las ejecuciones verdes (40053883124, 40054354927 y 40054969678)

| Dato | Valor |
| --- | --- |
| Artefacto | `SinNotas-ci-fix-signed-apk` |
| Archivo | `app-universal-release-unsigned-signed.apk` (9 129 058 bytes) |
| SHA-256 del APK | `e2eaad8cdbf9d7a94c9450d7cd76a9443aaf90304b4c332f4cea823ccf7866e0` |
| Paquete | `com.sinnotas.desktop` |
| versionName / versionCode | `0.1.1` / `1001` |
| minSdk / targetSdk | `33` / `37` |
| Certificado (DN) | `CN=Sin Notas, OU=Android, O=SinNotas, L=Bogota, ST=Bogota, C=CO` |
| SHA-256 del certificado | `fd3aa8bff77d23bfad24fc4a0c6eb50cdfa3f822611e4ea6a12b78ddcee25b2c` |
| Firma | `apksigner verify`: "Verifies", v3 `true` (v1/v2 `false`; Android 13+ usa v3; el APK conserva artefactos v1 `META-INF/<ALIAS>.SF/.RSA`) |
| Alineación | `zipalign -c -v 4`: "Verification successful" |
| Nativo | `lib/arm64-v8a/libsin_notas_lib.so` |
| `allowBackup` | `false` |
| `usesCleartextTraffic` | `false` |
| `debuggable` | ausente |
| Permisos | solo `com.sinnotas.desktop.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (sin INTERNET ni almacenamiento) |

La validación local se hizo sobre el artefacto descargado; no hay SDK Android
instalado en la máquina del agente, por lo que `apksigner`, `zipalign` y
`aapt2` se ejecutaron en CI y sus salidas se contrastaron con el log del job.
