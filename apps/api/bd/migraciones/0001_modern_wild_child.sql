CREATE TABLE "eventos_fallidos" (
	"id" serial PRIMARY KEY NOT NULL,
	"topico" text NOT NULL,
	"event_id" text NOT NULL,
	"tipo_evento" text NOT NULL,
	"carga" jsonb NOT NULL,
	"motivo" text NOT NULL,
	"reintentos" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventos_publicados" (
	"id" serial PRIMARY KEY NOT NULL,
	"topico" text NOT NULL,
	"event_id" text NOT NULL,
	"tipo_evento" text NOT NULL,
	"carga" jsonb NOT NULL,
	"publicado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eventos_publicados_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "pagos" (
	"id" serial PRIMARY KEY NOT NULL,
	"referencia_pago" text NOT NULL,
	"pedido_id" integer NOT NULL,
	"cliente_id" text NOT NULL,
	"monto_centavos" bigint NOT NULL,
	"moneda" text DEFAULT 'COP' NOT NULL,
	"proveedor" text DEFAULT 'wompi' NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"id_transaccion_proveedor" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pagos_referencia_pago_unique" UNIQUE("referencia_pago")
);
--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;