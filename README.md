# CoBien Furniture Interface (v1.0.0-1)

![CoBien Logo](/public/images/logo.png)

## 🌟 Descripción

**CoBien Furniture Interface** es la interfaz de control de próxima generación para el sistema de mobiliario inteligente CoBien. Diseñada con un enfoque **glassmorphic** de alta fidelidad, esta aplicación ofrece una experiencia de usuario premium, fluida y altamente ergonómica, optimizada específicamente para pantallas táctiles integradas en mobiliario.

Esta versión (**v1.0.0-1**) representa la culminación del rediseño visual y funcional, priorizando la accesibilidad mediante voz y la navegación táctil intuitiva.

## 🚀 Características Principales

- **🖼️ Pizarra (Board View)**: Sistema de mensajería inmersivo con visualización de imágenes a pantalla completa y narración por voz natural (Piper TTS) con pausas inteligentes.
- **📞 Llamame (Call View)**: Carrusel horizontal táctil con efectos de difuminado y fondos de paisajes dinámicos generados por IA para contactos sin foto. Incluye sistema de gestión de llamadas perdidas.
- **📅 Eventos (Events View)**: Calendario interactivo integrado con gestión de recordatorios y visualización de agenda diaria.
- **☁️ Tiempo (Weather View)**: Información meteorológica detallada con iconos dinámicos y previsión para varios días.
- **🎙️ Asistente de Voz**: Integración completa con Piper para la lectura de mensajes y notificaciones, mejorando la autonomía del usuario.
- **🎨 Diseño Premium**: Estética glassmorphic, tipografía escalada para máxima legibilidad y micro-animaciones en toda la interfaz.

## 🛠️ Tecnologías Utilizadas

- **Framework**: [Vue 3](https://vuejs.org/) (Composition API + TypeScript)
- **Runtime**: [Electron](https://www.electronjs.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Voz (TTS)**: [Piper TTS](https://github.com/rhasspy/piper) (Modelos locales de alta calidad)
- **Estilos**: CSS3 Moderno con variables y filtros de desenfoque.

## 📦 Instalación y Desarrollo

### Requisitos Previos

- Node.js (v18 o superior)
- npm o yarn

### Pasos para el despliegue

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/DeustoTech/cobien-furniture-electron.git
   cd cobien-furniture-electron
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Ejecutar en modo desarrollo**:
   ```bash
   npm run dev
   ```

4. **Construir para producción**:
   ```bash
   npm run build
   ```

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---
Desarrollado con ❤️ por **DeustoTech** para el proyecto CoBien.
