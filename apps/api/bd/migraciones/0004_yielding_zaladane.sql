CREATE TABLE "ofertas" (
	"id" serial PRIMARY KEY NOT NULL,
	"emprendedor_id" integer NOT NULL,
	"nombre" text NOT NULL,
	"descuento_bps" integer NOT NULL,
	"inicia_en" timestamp with time zone NOT NULL,
	"finaliza_en" timestamp with time zone NOT NULL,
	"estado" text DEFAULT 'activa' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "casos" ADD COLUMN "sla_vence_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "casos" ADD COLUMN "calificacion" integer;--> statement-breakpoint
ALTER TABLE "emprendedores" ADD COLUMN "medio_envio" text;--> statement-breakpoint
ALTER TABLE "emprendedores" ADD COLUMN "medio_pago_electronico" text;--> statement-breakpoint
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_emprendedor_id_emprendedores_id_fk" FOREIGN KEY ("emprendedor_id") REFERENCES "public"."emprendedores"("id") ON DELETE no action ON UPDATE no action;