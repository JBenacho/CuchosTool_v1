CREATE TABLE "caso_evidencias" (
	"id" serial PRIMARY KEY NOT NULL,
	"caso_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"url" text NOT NULL,
	"descripcion" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "casos" ADD COLUMN "asignado_a" text;--> statement-breakpoint
ALTER TABLE "emprendedores" ADD COLUMN "proveedor_logistico" text;--> statement-breakpoint
ALTER TABLE "caso_evidencias" ADD CONSTRAINT "caso_evidencias_caso_id_casos_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."casos"("id") ON DELETE no action ON UPDATE no action;