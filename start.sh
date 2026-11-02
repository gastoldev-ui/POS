#!/usr/bin/env bash
# start.sh — Levanta backend y frontend del POS Dulce Reino en WSL.
# Uso: ./start.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONT_DIR="$SCRIPT_DIR/frontend"

echo "🚀 Levantando POS Dulce Reino..."
echo "   Backend:  $BACKEND_DIR  →  http://localhost:4000"
echo "   Frontend: $FRONT_DIR    →  http://localhost:5173"
echo ""

# Cargar pnpm si no está en el PATH (pasa cuando se ejecuta desde
# el acceso directo de Windows, que no carga .bashrc).
if ! command -v pnpm >/dev/null 2>&1; then
  [ -d "$HOME/.local/share/pnpm" ] && export PATH="$HOME/.local/share/pnpm:$PATH"
  [ -s "$HOME/.nvm/nvm.sh" ] && source "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "❌ ERROR: pnpm no está en el PATH."
  echo "   Instalalo con: npm install -g pnpm"
  exit 1
fi

# Verificar que existan las dependencias instaladas en cada subproyecto.
# Si no, avisamos en vez de fallar con un error críptico de Vite/nodemon.
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
  echo "⚠️  Falta backend/node_modules. Corré: (cd backend && pnpm install)"
  exit 1
fi
if [ ! -d "$FRONT_DIR/node_modules" ]; then
  echo "⚠️  Falta frontend/node_modules. Corré: (cd frontend && pnpm install)"
  exit 1
fi

echo "✅ pnpm $(pnpm --version)"
echo ""

# Trap para matar los procesos al salir (Ctrl+C, cierre de terminal, etc.)
cleanup() {
  echo ""
  echo "🛑 Deteniendo..."
  kill $(jobs -p) 2>/dev/null
  wait 2>/dev/null
  exit 0
}
trap cleanup EXIT INT TERM

# Backend
( cd "$BACKEND_DIR" && pnpm dev ) &
BACKEND_PID=$!
echo "✅ Backend lanzado (PID: $BACKEND_PID)"

# Frontend
( cd "$FRONT_DIR" && pnpm dev ) &
FRONT_PID=$!
echo "✅ Frontend lanzado (PID: $FRONT_PID)"

echo ""
echo "⏳ Esperando... (Ctrl+C para detener todo)"
echo ""

# Si cualquiera de los dos muere, matamos el otro y salimos.
# Esto evita el caso feo de "el backend crasheó pero el front sigue vivo".
wait -n
echo "⚠️  Uno de los procesos terminó. Cerrando el otro..."
cleanup