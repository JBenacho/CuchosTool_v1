CREATE TABLE "despachos" (
	"id" serial PRIMARY KEY NOT NULL,
	"referencia" text NOT NULL,
	"pedido_id" integer NOT NULL,
	"transportista_id" integer NOT NULL,
	"vehiculo_id" integer NOT NULL,
	"guia" text NOT NULL,
	"ruta" text,
	"estado" text DEFAULT 'programado' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"entregado_en" timestamp with time zone,
	CONSTRAINT "despachos_referencia_unique" UNIQUE("referencia"),
	CONSTRAINT "despachos_pedido_id_unique" UNIQUE("pedido_id"),
	CONSTRAINT "despachos_guia_unique" UNIQUE("guia")
);
--> statement-breakpoint
CREATE TABLE "transportistas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"nit" text NOT NULL,
	"telefono" text,
	"poliza_vence_en" timestamp with time zone,
	"estado" text DEFAULT 'ACTIVO' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transportistas_nit_unique" UNIQUE("nit")
);
--> statement-breakpoint
CREATE TABLE "vehiculos" (
	"id" serial PRIMARY KEY NOT NULL,
	"transportista_id" integer NOT NULL,
	"placa" text NOT NULL,
	"capacidad_kg" integer DEFAULT 1000 NOT NULL,
	"estado" text DEFAULT 'ACTIVO' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehiculos_placa_unique" UNIQUE("placa")
);
--> statement-breakpoint
ALTER TABLE "despachos" ADD CONSTRAINT "despachos_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "despachos" ADD CONSTRAINT "despachos_transportista_id_transportistas_id_fk" FOREIGN KEY ("transportista_id") REFERENCES "public"."transportistas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "despachos" ADD CONSTRAINT "despachos_vehiculo_id_vehiculos_id_fk" FOREIGN KEY ("vehiculo_id") REFERENCES "public"."vehiculos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_transportista_id_transportistas_id_fk" FOREIGN KEY ("transportista_id") REFERENCES "public"."transportistas"("id") ON DELETE no action ON UPDATE no action;