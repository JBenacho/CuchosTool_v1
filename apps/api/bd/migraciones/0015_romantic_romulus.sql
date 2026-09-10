CREATE TABLE "comisiones" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendedor_id" text NOT NULL,
	"periodo" text NOT NULL,
	"base_centavos" bigint NOT NULL,
	"porcentaje_bps" integer NOT NULL,
	"monto_centavos" bigint NOT NULL,
	"estado" text DEFAULT 'calculada' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"pagada_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "comisiones_vendedor" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendedor_id" text NOT NULL,
	"porcentaje_bps" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comisiones_vendedor_vendedor_id_unique" UNIQUE("vendedor_id")
);
--> statement-breakpoint
CREATE TABLE "metas_comerciales" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendedor_id" text NOT NULL,
	"zona_id" text,
	"periodo" text NOT NULL,
	"monto_meta_centavos" bigint NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
