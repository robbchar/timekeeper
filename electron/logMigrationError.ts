import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export function logMigrationError(message: string, error?: Error) {
  const logDir = app.getPath('userData');
  const logFile = path.join(logDir, 'migrations.log');
  const timestamp = new Date().toISOString();
  const errorMessage = `[${timestamp}] ${message}${error ? `\n${error.stack}` : ''}\n\n`;
  console.log(app.getPath('userData'));
  console.log(errorMessage);
  try {
    fs.appendFileSync(logFile, errorMessage);
  } catch (writeErr) {
    console.error('Failed to write to migration log:', writeErr);
  }
}
