import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export interface DatabaseConfig {
  dbPath: string;
}

export function getDatabaseConfig(): DatabaseConfig {
  let dbPath: string;

  if (process.env.NODE_ENV === 'test') {
    // For tests, use a temporary directory
    dbPath = ':memory:';
  } else if (process.env.NODE_ENV === 'development') {
    // For development, use a local directory
    dbPath = path.join(process.cwd(), 'dev-db.sqlite');
    const dirPath = path.dirname(dbPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } else {
    // For production, use user data directory
    const userDataPath = app.getPath('userData');
    dbPath = path.join(userDataPath, 'timekeeper.db');
    const dirPath = path.dirname(dbPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  return {
    dbPath,
  };
}
