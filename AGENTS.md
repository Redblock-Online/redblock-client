# Agent Instructions for Documentation

This file contains instructions for AI agents to properly document the Redblock project.

## Documentation Guidelines

### 1. Documentation Location

All documentation should be added to `/documentation/docs/` following this structure:

```
documentation/docs/
├── intro.md                    # Project introduction
├── architecture/
│   └── overview.md            # System architecture
├── core-concepts/
│   ├── app.md                 # App class documentation
│   ├── editor-app.md          # EditorApp class documentation
│   └── game-loop.md           # Game loop and lifecycle
├── systems/
│   ├── physics.md             # Physics system
│   ├── audio.md               # Audio system
│   ├── target-manager.md      # Target management
│   └── networking.md          # WebSocket/multiplayer
├── editor/
│   ├── getting-started.md     # Editor basics
│   ├── generators.md          # Target generators
│   ├── events.md              # Event system
│   └── components.md          # Component system
├── api/
│   ├── app.md                 # App API reference
│   ├── editor-app.md          # EditorApp API reference
│   ├── physics-system.md      # PhysicsSystem API
│   ├── audio-manager.md       # AudioManager API
│   └── target-manager.md      # TargetManager API
└── performance/
    ├── optimization.md        # Performance optimization
    └── best-practices.md      # Best practices
```

### 2. Documentation Format

Use Markdown with the following frontmatter:

```markdown
---
sidebar_position: 1
title: Document Title
---

# Document Title

Brief introduction paragraph.

## Section 1

Content...

## Section 2

Content...
```

### 3. Code Documentation Standards

#### Class Documentation

```typescript
/**
 * Brief description of the class.
 * 
 * @example
 * ```typescript
 * const app = new App(ui, { disableServer: true });
 * app.start();
 * ```
 * 
 * @remarks
 * Additional context or important notes.
 */
export class ClassName {
  /**
   * Description of the property.
   * 
   * @default defaultValue
   */
  public propertyName: Type;

  /**
   * Description of the method.
   * 
   * @param paramName - Description of parameter
   * @returns Description of return value
   * 
   * @throws {ErrorType} When error occurs
   * 
   * @example
   * ```typescript
   * instance.methodName(value);
   * ```
   */
  public methodName(paramName: Type): ReturnType {
    // Implementation
  }
}
```

#### Function Documentation

```typescript
/**
 * Brief description of the function.
 * 
 * @param param1 - Description of first parameter
 * @param param2 - Description of second parameter
 * @returns Description of return value
 * 
 * @example
 * ```typescript
 * const result = functionName(value1, value2);
 * ```
 */
export function functionName(param1: Type1, param2: Type2): ReturnType {
  // Implementation
}
```

### 4. Documentation Sections to Include

For each major class or system, document:

1. **Overview**: What it does and why it exists
2. **Architecture**: How it fits into the system
3. **Key Concepts**: Important concepts to understand
4. **API Reference**: All public methods and properties
5. **Examples**: Common use cases with code
6. **Best Practices**: How to use it effectively
7. **Performance**: Performance considerations
8. **Troubleshooting**: Common issues and solutions

### 5. Specific Documentation Tasks

#### Core Systems

- **App.ts**: Document game lifecycle, initialization, and main loop
- **EditorApp.ts**: Document editor functionality and scenario management
- **PhysicsSystem.ts**: Document collision detection and character controller
- **AudioManager.ts**: Document multi-channel audio and spatial sound
- **TargetManager.ts**: Document object pooling and target lifecycle

#### Editor Systems

- **Target Generators**: Document RandomStaticGenerator and event system
- **Block System**: Document block placement and manipulation
- **Component System**: Document component creation and usage
- **Scenario System**: Document import/export and storage

#### UI Components

- **EditorRoot**: Document editor UI structure
- **PropertiesPanel**: Document property editing
- **GeneratorConfigPanel**: Document generator configuration
- **EventConfigPanel**: Document event configuration

### 6. Documentation Update Workflow

When making changes to code:

1. **Update JSDoc comments** in the source code
2. **Update relevant .md files** in `/documentation/docs/`
3. **Add examples** if introducing new features
4. **Update API reference** if changing public APIs
5. **Add migration guides** if breaking changes

### 7. Running Documentation

To preview documentation locally:

```bash
cd documentation
npm start
```

To build documentation:

```bash
cd documentation
npm run build
```

### 8. Documentation Style Guide

#### Writing Style

- Use **present tense**: "The system manages..." not "The system will manage..."
- Use **active voice**: "The App initializes..." not "The App is initialized..."
- Be **concise**: Remove unnecessary words
- Be **specific**: Use exact names and values
- Use **code examples**: Show, don't just tell

#### Code Examples

- Always include **working code** that can be copy-pasted
- Add **comments** to explain non-obvious parts
- Show **common use cases** first
- Include **error handling** when relevant

#### Diagrams

Use Mermaid for diagrams:

```markdown
\`\`\`mermaid
graph TD
    A[User Input] --> B[Controls]
    B --> C[App]
    C --> D[Physics System]
    D --> E[Renderer]
\`\`\`
```

### 9. Priority Documentation Areas

High priority (document first):

1. **App.ts** - Core game class
2. **EditorApp.ts** - Core editor class
3. **PhysicsSystem.ts** - Physics engine
4. **AudioManager.ts** - Audio system
5. **TargetManager.ts** - Target management
6. **Generator System** - Target generators and events

Medium priority:

1. **UI Components** - React components
2. **Utility Functions** - Helper functions
3. **Configuration** - Config files

Low priority:

1. **Internal helpers** - Private utility functions
2. **Legacy code** - Deprecated features

### 10. Examples of Good Documentation

See these files for examples:

- `/documentation/docs/intro.md` - Good introduction
- `/documentation/docs/architecture/overview.md` - Good architecture doc
- `/docs/AUDIO_SYSTEM.md` - Good technical documentation (migrate to Docusaurus)

### 11. Automated Documentation

Consider using:

- **TypeDoc** for API reference generation
- **Storybook** for UI component documentation
- **JSDoc** for inline code documentation

### 12. Documentation Checklist

Before considering documentation complete:

- [ ] All public APIs are documented
- [ ] All major systems have overview docs
- [ ] Code examples are tested and working
- [ ] Diagrams are clear and accurate
- [ ] Links between docs are working
- [ ] Sidebar navigation is logical
- [ ] Search works for key terms
- [ ] Mobile view is readable

## Agent-Specific Instructions

### When Adding New Features

1. Add JSDoc comments to all new public APIs
2. Create or update relevant documentation page
3. Add code examples
4. Update architecture diagrams if needed
5. Add to API reference

### When Fixing Bugs

1. Update documentation if behavior changed
2. Add troubleshooting section if common issue
3. Update examples if they were incorrect

### When Refactoring

1. Update all affected documentation
2. Add migration guide if breaking changes
3. Update architecture diagrams
4. Deprecate old documentation

### When Reviewing Code

1. Check that JSDoc comments exist
2. Verify documentation is accurate
3. Ensure examples work
4. Check for broken links

## Documentation Maintenance

### Regular Tasks

- **Weekly**: Review and update outdated docs
- **Monthly**: Check for broken links
- **Per Release**: Update version-specific docs
- **Per Major Release**: Update migration guides

### Quality Metrics

- All public APIs have JSDoc comments
- All major systems have overview docs
- All features have examples
- Documentation builds without errors
- No broken internal links

## Resources

- [Docusaurus Documentation](https://docusaurus.io/docs)
- [JSDoc Documentation](https://jsdoc.app/)
- [TypeDoc Documentation](https://typedoc.org/)
- [Markdown Guide](https://www.markdownguide.org/)
