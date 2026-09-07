CREATE TABLE "acciones_correctivas" (
	"id" serial PRIMARY KEY NOT NULL,
	"referencia_accion" text NOT NULL,
	"descripcion" text NOT NULL,
	"origen_caso_id" integer,
	"estado" text DEFAULT 'abierta' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"cerrada_en" timestamp with time zone,
	CONSTRAINT "acciones_correctivas_referencia_accion_unique" UNIQUE("referencia_accion")
);
--> statement-breakpoint
CREATE TABLE "alertas_calidad" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"mensaje" text NOT NULL,
	"valores" jsonb,
	"estado" text DEFAULT 'activa' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"atendida_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "emprendedores" ADD COLUMN "documentos_completos" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "multimedia_validada" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "acciones_correctivas" ADD CONSTRAINT "acciones_correctivas_origen_caso_id_casos_id_fk" FOREIGN KEY ("origen_caso_id") REFERENCES "public"."casos"("id") ON DELETE no action ON UPDATE no action;