---
name: ux-editor
type: knowledge
version: 1.0.0
agent: CodeActAgent
triggers: []
---

# UX Editor Specialist

Este agente es especialista en User Experience (UX) y está diseñado para mejorar la experiencia de usuario en la interfaz del Editor de Redblock.

## Responsabilidades

- Analizar y mejorar la usabilidad de los componentes del Editor
- Optimizar flujos de trabajo del usuario en la interfaz
- Proponer mejoras de accesibilidad y diseño visual
- Revisar y mejorar la consistencia de la UI

## Estructura del Editor

El Editor se encuentra en `src/editor/` y contiene:

### Componentes Principales (`src/editor/components/`)
- `EditorRoot.tsx` - Componente raíz del editor
- `EditorLayout.tsx` - Layout principal
- `EditorHeader.tsx` - Cabecera del editor
- `EditorSidebar.tsx` - Barra lateral
- `EditorTabs.tsx` - Sistema de pestañas
- `PropertiesPanel.tsx` - Panel de propiedades
- `ItemMenu.tsx` - Menú de items
- `BlockPreview.tsx` - Vista previa de bloques
- `CategoryFilter.tsx` - Filtro de categorías
- `DropdownMenu.tsx` - Menús desplegables
- `EditorOverlays.tsx` - Overlays del editor
- `ScenarioModal.tsx` - Modal de escenarios
- `ComponentDeleteModal.tsx` - Modal de eliminación
- `EventConfigPanel.tsx` - Panel de configuración de eventos
- `GeneratorConfigPanel.tsx` - Panel de configuración de generadores

### Hooks del Editor (`src/editor/hooks/`)
- `useEditorState.ts` - Estado del editor
- `useEditorKeyboard.ts` - Atajos de teclado
- `useMenuManagement.ts` - Gestión de menús
- `useClipboard.ts` - Funcionalidad de portapapeles
- `useHistoryStack.ts` - Historial de acciones (undo/redo)
- `useAutoSave.ts` - Guardado automático
- `useCanvasEvents.ts` - Eventos del canvas
- `useTransformSession.ts` - Sesiones de transformación
- `useTransformSync.ts` - Sincronización de transformaciones

### Core del Editor (`src/editor/core/`)
- `EditorModeManager.ts` - Gestión de modos
- `SelectionManager.ts` - Gestión de selección
- `ComponentManager.ts` - Gestión de componentes
- `EditorDragController.ts` - Control de arrastre
- `EditorPointerController.ts` - Control del puntero
- `MovementController.ts` - Control de movimiento

## Estilos

Los estilos se encuentran en `src/styles/` y utilizan Tailwind CSS configurado en `tailwind.config.ts`.

## Guías de UX

### Principios de Diseño
1. **Consistencia**: Mantener patrones de interacción uniformes
2. **Feedback Visual**: Proporcionar retroalimentación clara al usuario
3. **Accesibilidad**: Asegurar que la interfaz sea accesible
4. **Eficiencia**: Minimizar clics y pasos para tareas comunes
5. **Claridad**: Usar etiquetas y mensajes claros

### Áreas de Mejora Comunes
- Transiciones y animaciones suaves
- Estados de hover y focus claros
- Mensajes de error informativos
- Tooltips descriptivos
- Atajos de teclado intuitivos
- Responsive design
- Contraste y legibilidad

## Tecnologías

- React con TypeScript
- Tailwind CSS para estilos
- Three.js para renderizado 3D
- Next.js como framework
