# GeoStamp Pro - Procesador de Fotos y Generador de Marca de Agua GPS

GeoStamp Pro es una aplicación web moderna construida con **Next.js** que permite procesar lotes de fotografías, leer su metadata (incluyendo coordenadas GPS), aplicar diseños dinámicos de marcas de agua basados en la metadata e interpolación temporal, y descargar el lote resultante en un archivo ZIP.

## 🚀 Características Principales

- **Procesamiento por Lotes:** Sube múltiples fotos simultáneamente.
- **Detección de Metadata EXIF:** Lee automáticamente la fecha, hora y coordenadas GPS (latitud/longitud) de las fotografías.
- **Selector de Fecha y Hora Personalizado (`DateTimePicker`):** Reemplazo de los selectores nativos del navegador por un componente React personalizado de alto contraste, adaptado al tema oscuro y acentos rojos del sitio. Contiene navegación de calendario mensual y controles para ajustar hora y minutos.
- **Interpolación de Fechas:** 
  - Si una foto no posee fecha en su metadata, se puede interpolar automáticamente basándose en las fotos vecinas.
  - Permite configurar un rango de fechas manual (Inicio y Fin) y recalcular proporcionalmente la fecha y hora de todo el lote.
- **Asignación en Lote (Batch Edit):** Modifica la ubicación, estado ("Antes del Mantenimiento", "Durante el Mantenimiento", "Después del Mantenimiento") y otros metadatos para todo el lote a la vez.
  - **Soporte Multilínea en Ubicaciones:** Permite escribir descripciones en múltiples líneas (mediante textareas). El motor de Canvas divide, alinea y ajusta la altura de los textos de forma dinámica.
- **Limpieza Rápida del Procesador:** Botón dedicado para restablecer la cola de fotos y configuraciones de lote temporal, manteniendo intacta la configuración guardada de logos y empresa.
- **Personalización de Marca de Agua:**
  - **Logo de Empresa:** Sube un logo personalizado para estamparlo en la marca de agua.
  - **Ubicación del Logo:** Coloca el logo en la parte superior o inferior, alineado a la izquierda o derecha.
  - **Estilos de Diseño:** Soporte para diseño tipo "Plain Text" (Estilo A) y "Caja Compacta con Borde" (Estilo B), respetando las proporciones visuales. El estilo A oculta decoradores visuales y muestra el estado en texto plano.
  - **Datos del GPS:** Activa o desactiva la visibilidad de las coordenadas GPS y edítalas manualmente de ser necesario.
- **Ordenamiento Estable y Reactivo (Drag & Drop):** Posibilidad de reordenar las imágenes mediante arrastre directo o botones de subir/bajar. El sistema incluye un manejador `onDragEnd` para evitar elementos marcados persistentemente de forma errónea al cancelar arrastres.
- **Vista Previa en Tiempo Real:** Modal interactivo para visualizar el lienzo de la foto con la marca de agua renderizada antes de descargar.
- **Exportación Segura:** Generación de un archivo comprimido ZIP con todas las imágenes procesadas en alta definición y con su marca de agua integrada.

## 🛠️ Tecnologías Utilizadas

- **Core:** Next.js 16 (App Router), React 19, TypeScript.
- **Estilos:** Tailwind CSS v4.
- **Procesamiento de Imágenes y Datos:** HTML Canvas API, Exifr (lectura EXIF) y JSZip (generación de ZIP).
- **Control de Calidad:** Playwright (Pruebas E2E) y ESLint.

## 📦 Requisitos Previos y Restricciones de Seguridad

> [!IMPORTANT]
> **Normativa de Seguridad:** Para evitar vulnerabilidades de seguridad y ataques de cadena de suministro, **está estrictamente prohibido usar `npm` o `yarn`**. Toda instalación y ejecución debe hacerse utilizando **`pnpm`**.

Asegúrate de tener instalado:
- Node.js (v18.x o superior)
- `pnpm` (v8.x o superior)

## 🔧 Instalación y Desarrollo

Sigue estos pasos para configurar el proyecto localmente:

1. **Instalar dependencias:**
   ```bash
   pnpm install
   ```

2. **Iniciar el servidor de desarrollo:**
   ```bash
   pnpm dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación corriendo.

3. **Compilar el proyecto para producción:**
   ```bash
   pnpm build
   ```

4. **Ejecutar el linter:**
   ```bash
   pnpm run lint
   ```

## 🧪 Pruebas Unitarias y E2E (Playwright)

El proyecto cuenta con una suite de pruebas de extremo a extremo que validan el correcto funcionamiento de toda la interfaz sin errores de consola ni alertas del navegador.

1. **Instalar los navegadores de Playwright (si es la primera vez):**
   ```bash
   pnpm exec playwright install chromium
   ```

2. **Ejecutar las pruebas en segundo plano (Headless):**
   ```bash
   pnpm exec playwright test
   ```

3. **Ejecutar las pruebas con interfaz gráfica (UI Mode):**
   ```bash
   pnpm exec playwright test --ui
   ```

---

*Desarrollado con altos estándares de calidad, seguridad en dependencias y rendimiento.*
