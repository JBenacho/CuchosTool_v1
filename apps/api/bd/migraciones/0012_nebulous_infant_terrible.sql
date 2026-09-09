CREATE TABLE "ausencias" (
	"id" serial PRIMARY KEY NOT NULL,
	"empleado_id" integer NOT NULL,
	"fecha" timestamp with time zone NOT NULL,
	"motivo" text NOT NULL,
	"estado" text DEFAULT 'registrada' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cargos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"estado" text DEFAULT 'ACTIVO' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cargos_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "empleados" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"documento_unico" text NOT NULL,
	"correo" text,
	"telefono" text,
	"cargo_id" integer,
	"salario_base_centavos" bigint DEFAULT 0 NOT NULL,
	"fecha_ingreso" timestamp with time zone,
	"estado" text DEFAULT 'ACTIVO' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "empleados_documento_unico_unique" UNIQUE("documento_unico")
);
--> statement-breakpoint
CREATE TABLE "nominas" (
	"id" serial PRIMARY KEY NOT NULL,
	"periodo" text NOT NULL,
	"empleado_id" integer NOT NULL,
	"salario_base_centavos" bigint NOT NULL,
	"deducciones_centavos" bigint DEFAULT 0 NOT NULL,
	"neto_centavos" bigint NOT NULL,
	"estado" text DEFAULT 'generada' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"pagada_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_cargo_id_cargos_id_fk" FOREIGN KEY ("cargo_id") REFERENCES "public"."cargos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nominas" ADD CONSTRAINT "nominas_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleados"("id") ON DELETE no action ON UPDATE no action;