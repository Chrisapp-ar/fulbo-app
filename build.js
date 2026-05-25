import fs from 'fs';
import { execSync } from 'child_process';

console.log('Installing frontend dependencies...');
execSync('npm install --prefix frontend', { stdio: 'inherit' });

console.log('Building frontend...');
execSync('npm run build --prefix frontend', { stdio: 'inherit' });

console.log('Moving build output to root...');
if (fs.existsSync('./dist')) {
  fs.rmSync('./dist', { recursive: true, force: true });
}
fs.renameSync('frontend/dist', './dist');
console.log('Build completed successfully!');
