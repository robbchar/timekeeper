# TimeKeeper

A desktop time tracking application built with Electron, React, and TypeScript.

## 🚀 Features

- Track time spent on different projects
- Manage projects and sessions
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

- `npm start` - Start both Vite dev server and Electron app
- `npm run dev` - Start Vite dev server only
- `npm run electron:dev` - Start Electron app (requires Vite server to be running)
- `npm run build` - Build the app for production
- `npm run electron:build` - Build the Electron app
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build
- `npm test` - Run tests

## 📁 Project Structure

```
timekeeper/
├── src/                    # React source files
│   ├── components/        # React components
│   ├── contexts/         # React contexts
│   ├── hooks/           # Custom hooks
│   ├── pages/          # Page components
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

To run all tests (including main process and React tests):

```bash
npm test
```

**Tips:**

- No special setup is required; the tests will create and clean up a temporary database file automatically.
- If you want to run only the main process database tests:
  ```bash
  npx vitest --config vitest.electron.config.ts
  ```
- These tests do not require the Electron app to be running.

## 📦 Building for Production

To build the app for production:

```bash
npm run electron:build
```

The built application will be available in the `release` directory.

## 🤝 Contributing

1. Create a new branch for your feature
2. Make your changes
3. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details
