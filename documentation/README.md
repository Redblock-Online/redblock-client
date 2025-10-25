# Redblock Documentation

This is the official documentation for **Redblock**, a 3D FPS aim trainer built with Three.js and React.

The documentation is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

## 📚 Documentation Structure

```
docs/
├── intro.md                    # Project introduction
├── architecture/               # System architecture
├── core-concepts/              # Core classes and concepts
├── systems/                    # Individual systems (Physics, Audio, etc.)
├── editor/                     # Editor documentation
├── api/                        # API reference
└── performance/                # Performance optimization
```

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Local Development

```bash
npm start
```

This command starts a local development server and opens up a browser window at `http://localhost:3000`. Most changes are reflected live without having to restart the server.

### Build

```bash
npm run build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## 📝 Contributing to Documentation

See [AGENTS.md](../AGENTS.md) for detailed instructions on how to document the project.

### Quick Guidelines

1. **Add JSDoc comments** to all public APIs in the source code
2. **Create/update .md files** in the `docs/` directory
3. **Include code examples** with working code
4. **Use Mermaid** for diagrams
5. **Test documentation** locally before committing

### Documentation Standards

- Use **present tense** and **active voice**
- Be **concise** and **specific**
- Include **working code examples**
- Add **diagrams** where helpful
- Link to **related documentation**

## 🎯 Priority Areas

High priority documentation:

1. **App.ts** - Core game class
2. **EditorApp.ts** - Core editor class
3. **PhysicsSystem.ts** - Physics engine
4. **AudioManager.ts** - Audio system
5. **TargetManager.ts** - Target management
6. **Generator System** - Target generators and events

## 📖 Resources

- [Docusaurus Documentation](https://docusaurus.io/docs)
- [JSDoc Documentation](https://jsdoc.app/)
- [Markdown Guide](https://www.markdownguide.org/)
- [Mermaid Diagrams](https://mermaid.js.org/)

## 🔧 Deployment

### Using GitHub Pages

```bash
GIT_USER=<Your GitHub username> npm run deploy
```

### Using SSH

```bash
USE_SSH=true npm run deploy
```

This command builds the website and pushes to the `gh-pages` branch.
