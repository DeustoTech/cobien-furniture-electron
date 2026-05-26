#!/bin/bash
set -e

# Configuración de rutas
PROJECT_ROOT="/home/aritz/Development/DT/Projects/cobien/official"
VOSK_SRC_DIR="$PROJECT_ROOT/cobien_FrontEnd/app/virtual_assistant/vosk_models"
VOSK_DEST_DIR="$PROJECT_ROOT/cobien-furniture-electron/public/models/vosk"

echo "=== Creando directorio de destino ==="
mkdir -p "$VOSK_DEST_DIR"

echo "=== Empaquetando modelo en Español ==="
if [ -d "$VOSK_SRC_DIR/vosk-model-small-es-0.42" ]; then
  cd "$VOSK_SRC_DIR"
  tar -czf "$VOSK_DEST_DIR/vosk-model-small-es-0.42.tar.gz" vosk-model-small-es-0.42
  echo "✔ Modelo español empaquetado correctamente en public/models/vosk/vosk-model-small-es-0.42.tar.gz"
else
  echo "✖ No se encontró el modelo de español en $VOSK_SRC_DIR/vosk-model-small-es-0.42"
fi

echo "=== Empaquetando modelo en Francés ==="
if [ -d "$VOSK_SRC_DIR/vosk-model-small-fr-0.22" ]; then
  cd "$VOSK_SRC_DIR"
  tar -czf "$VOSK_DEST_DIR/vosk-model-small-fr-0.22.tar.gz" vosk-model-small-fr-0.22
  echo "✔ Modelo francés empaquetado correctamente en public/models/vosk/vosk-model-small-fr-0.22.tar.gz"
else
  echo "✖ No se encontró el modelo de francés en $VOSK_SRC_DIR/vosk-model-small-fr-0.22"
fi

echo "=== Fin ==="
