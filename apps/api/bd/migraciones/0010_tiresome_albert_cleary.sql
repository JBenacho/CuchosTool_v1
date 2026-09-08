CREATE TABLE "cuentas_por_pagar" (
	"id" serial PRIMARY KEY NOT NULL,
	"orden_id" integer NOT NULL,
	"proveedor_id" integer NOT NULL,
	"monto_centavos" bigint NOT NULL,
	"vence_en" timestamp with time zone NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"referencia_pago" text,
	"pagada_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cuentas_por_pagar_orden_id_unique" UNIQUE("orden_id")
);
--> statement-breakpoint
CREATE TABLE "ordenes_compra" (
	"id" serial PRIMARY KEY NOT NULL,
	"referencia" text NOT NULL,
	"solicitud_id" integer,
	"proveedor_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"bodega_destino_id" integer NOT NULL,
	"cantidad_pedida" integer NOT NULL,
	"cantidad_recibida" integer DEFAULT 0 NOT NULL,
	"precio_unitario_centavos" bigint NOT NULL,
	"estado" text DEFAULT 'pendiente_aprobacion' NOT NULL,
	"creado_por_rol" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ordenes_compra_referencia_unique" UNIQUE("referencia")
);
--> statement-breakpoint
CREATE TABLE "solicitudes_compra" (
	"id" serial PRIMARY KEY NOT NULL,
	"referencia" text NOT NULL,
	"producto_id" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"motivo" text NOT NULL,
	"solicitante_id" text,
	"solicitante_rol" text,
	"estado" text DEFAULT 'pendiente_revision' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "solicitudes_compra_referencia_unique" UNIQUE("referencia")
);
--> statement-breakpoint
ALTER TABLE "cuentas_por_pagar" ADD CONSTRAINT "cuentas_por_pagar_orden_id_ordenes_compra_id_fk" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_compra"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuentas_por_pagar" ADD CONSTRAINT "cuentas_por_pagar_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_solicitud_id_solicitudes_compra_id_fk" FOREIGN KEY ("solicitud_id") REFERENCES "public"."solicitudes_compra"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_bodega_destino_id_bodegas_id_fk" FOREIGN KEY ("bodega_destino_id") REFERENCES "public"."bodegas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes_compra" ADD CONSTRAINT "solicitudes_compra_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;