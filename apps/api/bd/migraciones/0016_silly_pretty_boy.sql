CREATE TABLE "horarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"empleado_id" integer NOT NULL,
	"dia_semana" integer NOT NULL,
	"hora_inicio" text NOT NULL,
	"hora_fin" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novedades_nomina" (
	"id" serial PRIMARY KEY NOT NULL,
	"empleado_id" integer NOT NULL,
	"periodo" text NOT NULL,
	"tipo" text DEFAULT 'devengo' NOT NULL,
	"concepto" text NOT NULL,
	"monto_centavos" bigint NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "cufe" text;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "estado_dian" text DEFAULT 'no_enviada' NOT NULL;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "dian_emitida_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "horarios" ADD CONSTRAINT "horarios_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novedades_nomina" ADD CONSTRAINT "novedades_nomina_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_cufe_unique" UNIQUE("cufe");