export interface Project {
  id: string;
  name: string;
  description: string;
  totalTime: number; // in milliseconds
  sessionCount: number;
  createdAt: string;
  updatedAt: string;
}
