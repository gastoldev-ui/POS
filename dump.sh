#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_FILE="$SCRIPT_DIR/dump-pos.txt"

ROOT="${1:-.}"
cd "$ROOT"

# Archivos que NUNCA deben aparecer en el dump (secretos + ruido)
EXCLUIR_PATRONES=(
  "*/node_modules/*"
  "*/.git/*"
  "*/dist/*"
  "*/build/*"
  "*/coverage/*"
  "*/data/*"
)

# Archivos por nombre exacto que jamás se dumpean (secretos)
EXCLUIR_NOMBRES=(
  ".env"
  ".env.local"
  ".env.production"
  "package-lock.json"
  "pnpm-lock.yaml"
  "yarn.lock"
)

# Tamaño máximo por archivo antes de truncar (en líneas)
MAX_LINEAS=2000

{
  echo "# PROYECTO: POS Dulce Reino"
  echo "# Ruta: $(pwd)"
  echo "# Fecha: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "# ============================================"
  echo ""

  echo "## ESTRUCTURA (sin node_modules/, sin dist/, sin backend/data/)"|
  echo '```'
  if command -v tree &>/dev/null; then
    tree -a -I 'node_modules|.git|dist|build|backend/data|coverage|dump-pos.txt' --dirsfirst -L 4
  else
    # fallback: paths completos sin indentar
        find . -type d \
      ! -path "*/node_modules*" \
      ! -path "*/.git*" \
      ! -path "*/dist*" \
      ! -path "*/build*" \
      ! -path "*/backend/data*" \
      ! -path "*/coverage*" \
      | sort | sed 's|^\./||'
  fi
  echo '```'
  echo ""

  echo "## ARCHIVOS"
  echo ""

  # Construir la expresión de exclusión para find
  FIND_EXCLUDE=()
  for pat in "${EXCLUIR_PATRONES[@]}"; do
    FIND_EXCLUDE+=(! -path "$pat")
  done
  for nom in "${EXCLUIR_NOMBRES[@]}"; do
    FIND_EXCLUDE+=(! -name "$nom")
  done

  # 👇 ACÁ AGREGAMOS *.vue Y *.mjs
  find . -type f \
    \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \
       -o -name "*.vue" -o -name "*.mjs" \
       -o -name "*.json" -o -name "*.md" -o -name "*.css" -o -name "*.html" \
       -o -name "*.example" -o -name "*.txt" -o -name "*.sh" \) \
    "${FIND_EXCLUDE[@]}" \
    ! -name "*.lock" \
    ! -name "dump-*.txt" \
    ! -name "*.log" \
    ! -name "*.min.js" \
    ! -name "*.min.css" \
    | sort | while read -r file; do
      rel="${file#./}"
      ext="${file##*.}"
      lineas_total=$(wc -l < "$file" 2>/dev/null || echo 0)

      echo "### \`${rel}\`"
      echo '```'"${ext}"

      if [ "$lineas_total" -gt "$MAX_LINEAS" ]; then
        head -n "$MAX_LINEAS" "$file"
        echo ""
        echo "... [TRUNCADO: ${lineas_total} líneas totales, mostrando ${MAX_LINEAS}] ..."
      else
        cat "$file"
      fi

      echo '```'
      echo ""
    done
} > "$OUTPUT_FILE"

echo "✅ Dump generado en: $OUTPUT_FILE"
echo "   Líneas: $(wc -l < "$OUTPUT_FILE")"
echo "   Tamaño: $(du -h "$OUTPUT_FILE" | cut -f1)"