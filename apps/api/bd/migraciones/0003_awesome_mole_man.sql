CREATE TABLE "dispersiones" (
	"id" serial PRIMARY KEY NOT NULL,
	"referencia_dispersion" text NOT NULL,
	"pedido_id" integer NOT NULL,
	"emprendedor_id" integer NOT NULL,
	"monto_centavos" bigint NOT NULL,
	"comision_centavos" bigint,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"ejecutado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dispersiones_referencia_dispersion_unique" UNIQUE("referencia_dispersion")
);
--> statement-breakpoint
CREATE TABLE "reembolsos" (
	"id" serial PRIMARY KEY NOT NULL,
	"referencia_reembolso" text NOT NULL,
	"pago_id" integer NOT NULL,
	"caso_id" integer,
	"monto_centavos" bigint NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reembolsos_referencia_reembolso_unique" UNIQUE("referencia_reembolso")
);
--> statement-breakpoint
ALTER TABLE "casos" ADD COLUMN "garantia_estado" text DEFAULT 'solicitada' NOT NULL;--> statement-breakpoint
ALTER TABLE "casos" ADD COLUMN "garantia_decidida_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "casos" ADD COLUMN "logistica_accion" text;--> statement-breakpoint
ALTER TABLE "dispersiones" ADD CONSTRAINT "dispersiones_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispersiones" ADD CONSTRAINT "dispersiones_emprendedor_id_emprendedores_id_fk" FOREIGN KEY ("emprendedor_id") REFERENCES "public"."emprendedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reembolsos" ADD CONSTRAINT "reembolsos_pago_id_pagos_id_fk" FOREIGN KEY ("pago_id") REFERENCES "public"."pagos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reembolsos" ADD CONSTRAINT "reembolsos_caso_id_casos_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."casos"("id") ON DELETE no action ON UPDATE no action;