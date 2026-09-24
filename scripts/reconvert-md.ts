import { convertDirectory } from '../src/services/markdown-service.js';
import { StorageService } from '../src/services/storage-service.js';

const data = process.argv[2] ?? './data';
const storage = new StorageService(data);
await storage.initialize();
const result = await convertDirectory(data);
console.log(JSON.stringify({ data, ...result }));
