// Configuracion por ambiente (CU-DEV-007 / RNF-MAN).
// Regla: los secretos vienen del entorno (.env local o Secret Manager en GCP), nunca del codigo.
const enteroDeEntorno = function (nombre: string, valorDefecto: number): number {
  const valor = process.env[nombre];
  if (!valor) return valorDefecto;
  const numero = parseInt(valor, 10);
  return Number.isNaN(numero) ? valorDefecto : numero;
};

export const config = {
  entorno: process.env.NODE_ENV || 'development',
  anfitrion: process.env.HOST || '0.0.0.0',
  puerto: enteroDeEntorno('PORT', 3001),
  nivelLog: process.env.LOG_LEVEL || 'info',
  secretoJwt: process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion',
  // Intervalo del publicador del buzon en ms (0 lo desactiva; dev: 15 s).
  intervaloPublicadorMs: enteroDeEntorno('PUBLICADOR_INTERVALO_MS', 15000),
  urlBaseDatos:
    process.env.DATABASE_URL || 'postgres://cuchos:cuchos_dev_pass@localhost:5433/cuchostool_dev',
};

export type ConfiguracionAplicacion = typeof config;
