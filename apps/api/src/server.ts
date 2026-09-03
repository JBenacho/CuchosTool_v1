import { buildApp } from './app';
import { config } from './config';

async function main(): Promise<void> {
  const app = await buildApp({ logger: true });
  const addr = await app.listen({ host: config.host, port: config.port });
  app.log.info('CuchosTool API escuchando en ' + addr);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Error iniciando API:', err);
  process.exit(1);
});
