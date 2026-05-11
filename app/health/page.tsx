
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export default async function HealthPage() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  const { version } = packageJson;

  return (
    <pre>
      ok
      version: {version}
    </pre>
  );
}
