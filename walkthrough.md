# Walkthrough - Resiliencia, Estabilidad y Expansión de Funcionalidades en los Muebles

He completado el análisis y la resolución técnica de los fallos que provocaban pantallas en negro durante las actualizaciones de los muebles físicos, la expansión de la encuesta de emociones a una escala de 5 niveles, la completitud del sistema de telemetría y logs ICSO, y la optimización de conectividad en producción (Versión 1.5.20).

---

## Cambios Realizados

### 1. Robustez en la App Electron (`cobien-furniture-electron`)
* **Archivo modificado:** [main.ts](file:///home/asier/cobien/cobien-furniture-electron/electron/main.ts)
* **Acción:** Se han añadido escuchadores de errores específicos para `process.stdout` y `process.stderr` para ignorar los errores de tubería rota (`EPIPE`) en el hilo principal.
* **Razón:** Evita bucles de excepciones infinitas recursivas cuando Vite/npm cierran las salidas estándar antes de que Electron termine de limpiarse.

### 2. Detección Inteligente en el Launcher (`cobien-furniture-app-launcher`)
* **Archivo modificado:** [cobien-launcher.sh](file:///home/asier/cobien/cobien-furniture-app-launcher/cobien-launcher.sh)
* **Acción:** 
  1. Se mejoró la variable de detección de Systemd (`is_running_inside_systemd_user_service`) para validar si la unidad actual es el supervisor (`cobien-launcher.service`).
  2. Si el proceso actual es del actualizador (`cobien-update.service`), **no se detiene a sí mismo** durante el desmantelamiento de supervisión.
  3. Se detiene de forma limpia el supervisor principal antes de realizar las comprobaciones Git para evitar que reinicie Electron concurrentemente.
  4. Se optimizó el proceso para que la app no se apague hasta que el actualizador compruebe que efectivamente existen commits nuevos en Git.
  5. **Auto-Limpieza Preventiva (Novedad):** Se añadió el comando `git -C "$repo" reset --hard HEAD --quiet` antes del `git pull` de actualización. Esto descarta automáticamente cualquier archivo de compilación local modificado (como `dist-electron/main.js` o `preload.mjs`) garantizando que la actualización nunca se bloquee por conflictos de merge en el disco local de los muebles.

---

## Expansión del Módulo de Emociones a 5 Niveles (Versión 1.5.17)

Se ha completado con éxito la transición de la encuesta diaria de emociones de 3 niveles a **5 niveles** (Excelente, Bien, Normal, Regular, Muy mal), mejorando la escala de evaluación del estado de ánimo del usuario final.

### Cambios Realizados:
1. **Frontend - Pantalla de Selección (`cobien-furniture-electron`):**
   * **Archivo:** [EmotionPromptOverlay.vue](file:///home/asier/cobien/cobien-furniture-electron/src/components/EmotionPromptOverlay.vue)
   * **Modificación:** Se reemplazaron los 3 botones por 5 botones con los emojis 😄 (Excelente), 🙂 (Bien), 😐 (Normal), 🙁 (Regular), 😢 (Muy mal).
   * **Estilos:** Se ajustaron los anchos, márgenes y fuentes (emojis a `5rem`, texto a `1.5rem`) de `.emotion-btn` para asegurar un ajuste perfecto sin desbordamientos de texto en pantallas pequeñas. Se añadieron las clases de hover `.excellent`, `.good`, `.average`, `.poor`, `.bad` con colores y sombras correspondientes.
2. **Frontend - Internacionalización:**
   * **Archivos:** [es.json](file:///home/asier/cobien/cobien-furniture-electron/src/i18n/locales/es.json), [en.json](file:///home/asier/cobien/cobien-furniture-electron/src/i18n/locales/en.json), [fr.json](file:///home/asier/cobien/cobien-furniture-electron/src/i18n/locales/fr.json)
   * **Modificación:** Se añadieron las traducciones correspondientes para los nuevos niveles de emoción en los tres idiomas soportados (Español, Inglés y Francés).
3. **Backend - Panel de Control (`cobien-backend`):**
   * **Archivo:** [devices_admin.html](file:///home/asier/cobien/cobien-backend/cobien-backend/apps/pizarra/templates/pizarra/devices_admin.html)
   * **Modificación:** Se actualizó la lógica de renderizado del historial de emociones para mostrar los emojis correspondientes a las 5 nuevas strings de estado (`Excelente`, `Bien`, `Normal`, `Regular`, `Muy mal`), manteniendo la compatibilidad con registros antiguos del historial (`Mal` y `Triste` mapeados a 😢).

---

## Completitud y Corrección en Telemetría y Logs ICSO (Versión 1.5.19)

Se ha corregido y completado la recolección, cuantificación y sincronización del sistema de telemetría ICSO, garantizando la fiabilidad de las métricas en el portal de Co-bien.

### Cambios Realizados:
1. **Llamadas de Vídeo (Twilio):** Se integró `logVideoCallEvent(...)` en los manejadores de Electron para registrar las solicitudes de llamada (`request`), el inicio de llamada (`made`) y la duración real en segundos al cerrarse la ventana de llamada (`ended`).
2. **Mapeo de Rutas de Vue:** Se solucionó el problema en `logNavigation` donde las visitas a la página de contactos (ruta `/call`) no se contaban, mapeando correctamente `call` a la clave `contacts` del JSON de telemetría.
3. **Canal de Navegación (lastNavSource):** Se implementó un rastreo del origen de la navegación en `router/index.ts` que se reinicia a `touchscreen`. Las navegaciones por voz (`useVoiceAssistant.ts`) o RFID/Sensores (`useMqtt.ts`) ahora actualizan esta variable antes de cambiar la ruta, logrando que el portal diferencie correctamente el método de acceso de los usuarios.
4. **Trazas Detalladas del Asistente de Voz:** Se expuso el IPC `icso:logVocalAssistant` permitiendo que el asistente de voz escriba en tiempo real al log cronológico `icso_log.txt` cuando es activado, cuando entiende un comando (incluyendo el texto reconocido) y cuando no lo entiende.
5. **Eventos y Tablón:** Se añadieron llamadas a `logNotificationReceived(...)` para contabilizar la recepción de mensajes/fotos en el tablón (bajo el topic MQTT `board/reload`) y la creación de eventos de calendario (tanto manuales mediante `events:addPersonal` como remotos mediante el sondeo de notificaciones).
6. **Salida del Modo de Espera:** En `IdleOverlay.vue` se añadió un watch que detecta cuando `isIdle` pasa a `false`, invocando `logScreenWakeup()` para registrar la salida del modo reposo de la pantalla.

---

## Optimización para Producción: Silenciado de Desconexiones y Red de Dispositivos (Versión 1.5.20)

Para preparar los equipos de cara a su entrega final en producción, se ha deshabilitado la pantalla de aviso de caída de red y se ha resuelto el origen de la inestabilidad Wi-Fi en los portátiles físicos.

### Cambios Realizados:
1. **Ocultación del Aviso de Red:**
   * **Archivo:** [App.vue](file:///home/asier/cobien/cobien-furniture-electron/src/App.vue)
   * **Modificación:** Se eliminó por completo el bloque de marcado `<div class="offline-overlay">` y sus dependencias de temporización (`countdownInterval`, `countdown` y `goToWifi()`). Ahora, si el equipo pierde temporalmente la conexión, el usuario no es interrumpido por una ventana emergente ni es redirigido a la pantalla de configuración Wi-Fi de forma abrupta.
2. **Desactivación de Wi-Fi Power Saving:**
   * **Archivos modificados en los dispositivos:** `/etc/NetworkManager/conf.d/default-wifi-powersave-on.conf` en `CoBien1` y `CoBien2`.
   * **Acción:** Se modificó el valor por defecto `wifi.powersave = 3` (activado) a `wifi.powersave = 2` (desactivado permanente).
   * **Razón:** El modo de ahorro de energía Wi-Fi en portátiles Linux con tarjetas de red integradas provoca latencias extremas y microcortes de forma agresiva. Tras cambiarlo y reiniciar NetworkManager, la latencia media bajó a niveles estables y los paquetes ICMP se transmiten sin retardos de segundos.

---

## SSH Connection Guide (Túneles de RustDesk)

Para acceder de forma rápida y remota a ambos muebles desde este equipo de desarrollo a través de sus respectivos túneles TCP en RustDesk, utiliza los siguientes comandos:

* **Acceso a `CoBien1` (Puerto 2221):**
  ```bash
  ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p 2221 cobien@127.0.0.1
  ```

* **Acceso a `CoBien2` (Puerto 2222):**
  ```bash
  ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p 2222 cobien@127.0.0.1
  ```

---

## Verificación Realizada

### 1. Entorno de Simulación (`CoBien7` - Máquina Virtual)
* Se simuló una actualización manual con repositorios en limpio. El servicio `cobien-update.service` completó la verificación, reinició la app y el supervisor arrancó de forma limpia la nueva compilación.

### 2. Dispositivo Físico Real `CoBien1` (Acer Laptop con ID `1501522615`)
* **Estado inicial:** Versión `1.5.19`.
* **Procedimiento:** Conexión mediante RustDesk en el puerto `2221`. Desactivación de Wi-Fi power saving (`Power save: off`), reinicio de NetworkManager y posterior despliegue automático del frontend en la versión `1.5.20`.
* **Resultado:** **Actualizado con éxito**. El sistema no muestra ningún overlay al desconectar y la conexión Wi-Fi es estable y responde sin jitter extremo.

### 3. Dispositivo Físico Real `CoBien2` (Lenovo Yoga con ID `1252003351`)
* **Estado inicial:** Versión `1.5.19`.
* **Procedimiento:** Conexión mediante RustDesk en el puerto `2222`. Modificación del fichero de ahorro de energía Wi-Fi a `2` y posterior actualización de la app a la versión `1.5.20`.
* **Resultado:** **Actualizado con éxito**. Ejecución fluida y sin bloqueos de red.

---

## Nuevas Mejoras y Correcciones (Julio 14, 2026)

### 1. Resolución Técnica de la Pantalla en Negro en los Muebles (`cobien-launcher`)
* **Archivo modificado:** [cobien-launcher.sh](file:///home/asier/cobien/cobien-furniture-app-launcher/cobien-launcher.sh)
* **Problema:** El script diario de actualización automática (`cobien-update.service`) detiene el lanzador principal para buscar actualizaciones de git. Si el chequeo de git falla por microcortes de red o no hay actualizaciones a aplicar (`updated=0`), el script de actualización finalizaba correctamente pero dejaba el servicio del lanzador detenido (`inactive (dead)`). Esto provocaba que el portátil mostrara una pantalla negra indefinidamente sobre la sesión vacía de Openbox.
* **Solución:** Se añadió una lógica de recuperación automática al final del método de actualización `run_update_once`. Si el servicio del lanzador fue detenido pero no se ha aplicado ningún cambio final en los repositorios, el actualizador detecta que el servicio supervisor está inactivo y lo levanta de inmediato (`systemctl --user restart cobien-launcher.service`), restaurando el estado de la aplicación.
* **Despliegue:** 
  1. Commit y push realizados sobre la rama `master` del repositorio `cobien-furniture-app-launcher`.
  2. Conectado a **`CoBien1`** y **`CoBien2`** a través de sus respectivos túneles SSH remotos, aplicando el parche `git pull` de forma inmediata.
  3. Levantado con éxito el entorno gráfico en `CoBien1` (`systemctl --user start cobien-launcher.service`), quedando totalmente operativo.

### 2. Optimización y Compresión de Imágenes en el Tablón de la Pizarra (`cobien-backend`)
* **Archivos modificados/creados:** 
  * [views.py](file:///home/asier/cobien/cobien-backend/cobien-backend/apps/pizarra/views.py)
  * [optimize_all_gridfs_images.py](file:///home/asier/cobien/cobien-backend/cobien-backend/optimize_all_gridfs_images.py) [NUEVO]
* **Problema:** Al adjuntar imágenes de alta resolución en los mensajes de la pizarra desde el panel web (por ejemplo, fotos directas de smartphones), se subían a MongoDB GridFS sin compresión (con tamaños de 2MB a 5MB). Esto provocaba que la web tardase mucho en cargarlas y que la aplicación de Electron de los muebles lanzase un timeout de descarga de 15 segundos (`AbortSignal.timeout`), mostrando el aviso `"Sin imagen"`.
* **Solución:** 
  1. Se modificó la rutina de guardado en `pizarra_create` y `api_pizarra_create_multi` en el backend para comprimir y redimensionar automáticamente las imágenes antes de persistirlas.
  2. **Resolución y Calidad Unificadas:** Se actualizó la función helper `_optimize_image_file` en el backend para cambiar su tamaño máximo por defecto de `(300, 300)` a **`(1024, 1024)`**. De esta forma, tanto las imágenes de pizarra como las nuevas fotos de contactos/avatares y personas del directorio se optimizan en una resolución de gran calidad de hasta **1024x1024 píxeles** (JPEG calidad 85).
  3. **Migración Completa de Base de Datos:** Se ha implementado y ejecutado el script `optimize_all_gridfs_images.py` que recorrió todas las colecciones de almacenamiento de GridFS (`pizarra_fs`, `pizarra_contacts_fs`, `pizarra_people_fs`):
     * Optimizó **40 imágenes pesadas** del tablón que no estaban comprimidas.
     * Liberó y ahorró un total de **50.28 MB** de ancho de banda y espacio en MongoDB Atlas.
     * Los avatares y fotos existentes de 300x300 se omitieron de forma segura para no provocar pérdida de calidad por re-compresión.
* **Resultado:** Las imágenes de la pizarra y de los contactos ahora se descargan en los muebles en menos de **1.4 segundos** (antes daban timeout), resolviendo el error de "Sin imagen" de forma definitiva e instantánea.

### 3. Restablecimiento de Datos de Muebles desde la Zona de Peligro (`cobien-backend`)
* **Archivos modificados:** 
  * [views.py](file:///home/asier/cobien/cobien-backend/cobien-backend/apps/pizarra/views.py)
  * [devices_admin.html](file:///home/asier/cobien/cobien-backend/cobien-backend/apps/pizarra/templates/pizarra/devices_admin.html)
  * [views.py en apps/eventos](file:///home/asier/cobien/cobien-backend/cobien-backend/apps/eventos/views.py)
* **Funcionalidad:** Se diseñó e implementó un mecanismo de reseteo "suave" (soft-reset) para limpiar la información de un mueble sin borrar la base de datos:
  1. **Ocultado de Mensajes y Eventos**: Las colecciones de mensajes y eventos se marcan con `sync_until = now()` y `hidden = True`. Ambas colecciones quedan excluidas en las APIs de los dispositivos (`api_device_events` y `api_pizarra_messages`), vistas estándar de calendario (`lista_eventos`), y en las consultas directas de MongoDB Atlas realizadas por la aplicación de Electron (se modificó `eventsMongo.ts` para filtrar por `hidden: { $ne: true }`).
  2. **Reinicio de Métricas**: Se guarda un marcador temporal `telemetry_reset_at` en el perfil del mueble y se limpia el campo `payload` en el snapshot de la base de datos.
  3. **Comando `icso_reset`**: Se implementó la recepción del comando `icso_reset` en la app de Electron (`backendSync.ts` e `icsoService.ts`). Al recibirlo, la app sobreescribe su archivo de telemetría local (`icso_log.json`) con valores inicializados a 0 y fuerza un sync inmediato al backend, asegurando que los contadores acumulados se reseteen tanto a nivel local como en la nube.
  4. **Ocultado de Logs**: Las entradas de consola previas se marcan como `hidden` y se omiten del selector y visor de logs del panel.
  5. **Comando de Recarga**: Al realizar el reseteo, se encola una recarga inmediata de eventos y tablón (`board/reload`, `events/reload`) enviada por MQTT para actualizar la pantalla física del mueble.
  6. **Confirmación Segura**: Se integró un modal `#resetDeviceModal` en la pestaña de Zona de Peligro que obliga al administrador a teclear el ID único del mueble para validar el reseteo de datos.
  7. **Verificación**: Cambios probados y validados con éxito en la máquina virtual **`CoBien7`**. Se comprobó que el archivo local `icso_log.json` fue reseteado a 0, la base de datos MongoDB Atlas actualizó su snapshot a 0, y los eventos personales anteriores desaparecieron de la caché local del dispositivo (`events.local.json`), mostrando únicamente los eventos públicos del centro.

---

## Frases Contextuales de Mañana y Noche según Requerimientos CIBIR (Versión 1.5.30)

Se ha completado e integrado la extensión de la encuesta diaria de emociones atendiendo a las peticiones del CIBIR (Centro de Investigación Biomédica de La Rioja / Rioja Salud).

### Cambios Realizados:
1. **Frontend (`EmotionPromptOverlay.vue`)**:
   * Se evalúa dinámicamente el horario de la encuesta al abrirse:
     * **Franja de Mañana (< 10:00h)**: Se muestra la sección *"Cuéntanos sobre tu descanso:"* con opciones chip seleccionables (*"He dormido bien esta noche"*, *"Me siento descansado"*).
     * **Franja de Noche (≥ 20:00h)**: Se muestra la sección *"¿Cómo ha ido tu día?"* con opciones chip seleccionables (*"Hoy me he sentido querido"*, *"Hoy me he sentido acompañado"*, *"Hoy ha sido un buen día para mí"*).
     * **Franja Intermedia (10:00h - 20:00h)**: Mantiene la encuesta estándar con los 5 botones de emociones.
   * Se conservan de forma prominente los 5 botones tradicionales con emojis (😄 Excelente, 🙂 Bien, 😐 Normal, 🙁 Regular, 😢 Muy mal).
2. **Internacionalización (`es.json`, `en.json`, `fr.json`)**:
   * Se han traducido fielmente todas las frases y títulos contextuales en Español, Inglés y Francés.
3. **Backend & IPC (`main.ts` / `preload.ts`)**:
   * Se actualizó el manejador `config:submitEmotion` para aceptar un payload extendido `{ emotion, statements, period, timestamp }` manteniendo compatibilidad absoluta con peticiones de texto plano tradicionales.
4. **Gestión de Git y Versionado**:
   * Se ha establecido la política de incremento automático de versión (`1.5.30`) y sincronización simultánea de la rama `develop` con `master`.
5. **Verificación y Despliegue**:
   * **`CoBien1`**: Actualizado e impulsado a la versión `1.5.30` vía SSH (`systemctl --user start cobien-update.service`), verificado servicio en estado `active` y cambios reflejados en pantalla táctil.




