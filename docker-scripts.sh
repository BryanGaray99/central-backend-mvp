#!/bin/bash

# Script para manejar la aplicación Docker

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para mostrar ayuda
show_help() {
    echo "Uso: $0 [comando]"
    echo ""
    echo "Comandos disponibles:"
    echo "  build     - Construir la imagen Docker"
    echo "  start     - Iniciar la aplicación en producción"
    echo "  start-dev - Iniciar la aplicación en modo desarrollo"
    echo "  stop      - Detener la aplicación"
    echo "  restart   - Reiniciar la aplicación"
    echo "  logs      - Mostrar logs de la aplicación"
    echo "  shell     - Abrir shell en el contenedor"
    echo "  clean     - Limpiar contenedores e imágenes"
    echo "  help      - Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0 build"
    echo "  $0 start"
    echo "  $0 logs"
}

# Función para construir la imagen
build() {
    echo -e "${GREEN}Construyendo imagen Docker...${NC}"
    docker-compose build
    echo -e "${GREEN}Imagen construida exitosamente${NC}"
}

# Función para iniciar en producción
start() {
    echo -e "${GREEN}Iniciando aplicación en producción...${NC}"
    docker-compose up -d
    echo -e "${GREEN}Aplicación iniciada en http://localhost:3000${NC}"
    echo -e "${YELLOW}Swagger UI disponible en http://localhost:3000/api${NC}"
}

# Función para iniciar en desarrollo
start_dev() {
    echo -e "${GREEN}Iniciando aplicación en modo desarrollo...${NC}"
    docker-compose --profile dev up -d
    echo -e "${GREEN}Aplicación de desarrollo iniciada en http://localhost:3001${NC}"
    echo -e "${YELLOW}Swagger UI disponible en http://localhost:3001/api${NC}"
}

# Función para detener
stop() {
    echo -e "${YELLOW}Deteniendo aplicación...${NC}"
    docker-compose down
    echo -e "${GREEN}Aplicación detenida${NC}"
}

# Función para reiniciar
restart() {
    echo -e "${YELLOW}Reiniciando aplicación...${NC}"
    docker-compose restart
    echo -e "${GREEN}Aplicación reiniciada${NC}"
}

# Función para mostrar logs
logs() {
    echo -e "${GREEN}Mostrando logs de la aplicación...${NC}"
    docker-compose logs -f
}

# Función para abrir shell
shell() {
    echo -e "${GREEN}Abriendo shell en el contenedor...${NC}"
    docker-compose exec central-backend sh
}

# Función para limpiar
clean() {
    echo -e "${YELLOW}Limpiando contenedores e imágenes...${NC}"
    docker-compose down --rmi all --volumes --remove-orphans
    echo -e "${GREEN}Limpieza completada${NC}"
}

# Función para verificar estado
status() {
    echo -e "${GREEN}Estado de los contenedores:${NC}"
    docker-compose ps
}

# Verificar que Docker esté instalado
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker no está instalado${NC}"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}Error: Docker Compose no está instalado${NC}"
        exit 1
    fi
}

# Función principal
main() {
    check_docker
    
    case "$1" in
        build)
            build
            ;;
        start)
            start
            ;;
        start-dev)
            start_dev
            ;;
        stop)
            stop
            ;;
        restart)
            restart
            ;;
        logs)
            logs
            ;;
        shell)
            shell
            ;;
        clean)
            clean
            ;;
        status)
            status
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}Comando no reconocido: $1${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Ejecutar función principal
main "$@" 