# TimeKeeper

A desktop time tracking application built with Electron, React, and TypeScript.

## 🚀 Features

- Track time spent on different projects
- Manage projects and sessions
- Edit a session's notes on the timer screen, and its elapsed time while the timer is paused
- Closing the app keeps an unfinished session; it comes back paused on the next launch
- A red dot on the Windows taskbar icon while the timer is counting
- Leaving the timer page pauses a running timer, keeping the time counted so far
- Tag-based organization
- Export functionality
- Dark/Light theme support

## 🛠️ Tech Stack

- **Framework:** Electron + React
- **Language:** TypeScript
- **Build Tool:** Vite
- **Database:** SQLite
- **UI Library:** Heroui
- **Styling:** styled-components
- **Testing:** Vitest + React Testing Library
- **Date Utils:** date-fns

## 🏗️ Development Setup

### Prerequisites

- Node.js (v18 or higher)
- npm (v8 or higher)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/robbchar/timekeeper.git
cd timekeeper
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm start
```

This will start both the Vite development server and the Electron app. The Electron window will open automatically once the Vite server is ready.

### Available Scripts

- `npm start` - Start the Vite dev server (and Electron via `vite-plugin-electron`)
- `npm run dev` - Start the Vite dev server (development mode)
- `npm run build` - Typecheck + build the renderer and Electron bundles to `dist/` and `dist-electron/`
- `npm run build:installer` - Build a Windows installer with `electron-builder`
- `npm run lint` - Run ESLint
- `npm run type-check` - Typecheck only (`tsc --noEmit`)
- `npm test` - Run renderer tests (Vitest watch mode)
- `npm run test:db` - Run db-focused tests
- `npm run test:electron` - Run Electron main-process tests (Node environment)
- `npm run test:all` - Run all test suites once (CI-style)

## 📁 Project Structure

```
timekeeper/
├── src/                    # React source files
│   ├── components/        # React components
│   ├── contexts/         # React contexts
│   ├── state/           # Reducers + state services
│   ├── test-utils/      # Test helpers
│   ├── types/           # Shared domain and contract types
│   ├── styles/        # Global styles
│   └── utils/        # Utility functions
├── electron/          # Electron main process
├── public/          # Static assets
└── docs/           # Documentation
```

## 🧪 Testing

Run tests with:

```bash
npm test
```

### Main Process (Electron) Database Tests

The main process database logic is covered by unit tests in [`electron/database.test.ts`](electron/database.test.ts). These tests use Vitest and run in a Node environment. They cover CRUD operations for projects, sessions, tags, and settings using a temporary SQLite database file for isolation.

To run all tests (renderer + db-focused + main process tests), once:

```bash
npm run test:all
```

**Tips:**

- No special setup is required; the tests will create and clean up a temporary database file automatically.
- If you want to run only the main process database tests:
  ```bash
  npx vitest --config vitest.electron.config.ts
  ```
- These tests do not require the Electron app to be running.

## 📦 Building for Production

To build the app bundles (renderer + Electron entry points):

```bash
npm run build
```

To build a Windows installer, use:

```bash
npm run build:installer
```

Installer output will be available in the `release` directory.

## 🤝 Contributing

1. Create a new branch for your feature
2. Make your changes
3. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details
