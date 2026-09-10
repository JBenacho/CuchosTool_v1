CREATE TABLE "orden_compra_lineas" (
	"id" serial PRIMARY KEY NOT NULL,
	"orden_id" integer NOT NULL,
	"numero_linea" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"cantidad_pedida" integer NOT NULL,
	"cantidad_recibida" integer DEFAULT 0 NOT NULL,
	"precio_unitario_centavos" bigint NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ruta_paradas" (
	"id" serial PRIMARY KEY NOT NULL,
	"ruta_id" integer NOT NULL,
	"secuencia" integer NOT NULL,
	"destino" text NOT NULL,
	"despacho_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rutas" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"transportista_id" integer NOT NULL,
	"vehiculo_id" integer NOT NULL,
	"estado" text DEFAULT 'planificada' NOT NULL,
	"creado_por_rol" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"iniciada_en" timestamp with time zone,
	"completada_en" timestamp with time zone,
	CONSTRAINT "rutas_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
ALTER TABLE "ordenes_compra" ALTER COLUMN "producto_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ordenes_compra" ALTER COLUMN "precio_unitario_centavos" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "despachos" ADD COLUMN "ruta_id" integer;--> statement-breakpoint
ALTER TABLE "ordenes_compra" ADD COLUMN "tarifa_iva_bps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ordenes_compra" ADD COLUMN "subtotal_centavos" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ordenes_compra" ADD COLUMN "impuesto_centavos" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ordenes_compra" ADD COLUMN "total_centavos" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "proveedores" ADD COLUMN "tarifa_iva_bps" integer DEFAULT 1900 NOT NULL;--> statement-breakpoint
ALTER TABLE "orden_compra_lineas" ADD CONSTRAINT "orden_compra_lineas_orden_id_ordenes_compra_id_fk" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_compra"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_compra_lineas" ADD CONSTRAINT "orden_compra_lineas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ruta_paradas" ADD CONSTRAINT "ruta_paradas_ruta_id_rutas_id_fk" FOREIGN KEY ("ruta_id") REFERENCES "public"."rutas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ruta_paradas" ADD CONSTRAINT "ruta_paradas_despacho_id_despachos_id_fk" FOREIGN KEY ("despacho_id") REFERENCES "public"."despachos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rutas" ADD CONSTRAINT "rutas_transportista_id_transportistas_id_fk" FOREIGN KEY ("transportista_id") REFERENCES "public"."transportistas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rutas" ADD CONSTRAINT "rutas_vehiculo_id_vehiculos_id_fk" FOREIGN KEY ("vehiculo_id") REFERENCES "public"."vehiculos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "orden_compra_lineas_orden_numero_idx" ON "orden_compra_lineas" USING btree ("orden_id","numero_linea");--> statement-breakpoint
CREATE INDEX "orden_compra_lineas_orden_idx" ON "orden_compra_lineas" USING btree ("orden_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ruta_paradas_ruta_secuencia_idx" ON "ruta_paradas" USING btree ("ruta_id","secuencia");--> statement-breakpoint
CREATE UNIQUE INDEX "ruta_paradas_ruta_destino_idx" ON "ruta_paradas" USING btree ("ruta_id","destino");--> statement-breakpoint
ALTER TABLE "despachos" ADD CONSTRAINT "despachos_ruta_id_rutas_id_fk" FOREIGN KEY ("ruta_id") REFERENCES "public"."rutas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Backfill (CU-ERP-003): las ordenes existentes de una linea se migran a la tabla de lineas
-- y se recalculan sus totales con la tarifa de IVA pactada con el proveedor.
INSERT INTO "orden_compra_lineas" ("orden_id", "numero_linea", "producto_id", "cantidad_pedida", "cantidad_recibida", "precio_unitario_centavos")
SELECT oc."id", 1, oc."producto_id", oc."cantidad_pedida", oc."cantidad_recibida", oc."precio_unitario_centavos"
FROM "ordenes_compra" oc
WHERE oc."producto_id" IS NOT NULL;--> statement-breakpoint
UPDATE "ordenes_compra" oc
SET "tarifa_iva_bps" = p."tarifa_iva_bps",
    "subtotal_centavos" = oc."cantidad_pedida" * oc."precio_unitario_centavos",
    "impuesto_centavos" = ROUND(oc."cantidad_pedida" * oc."precio_unitario_centavos" * p."tarifa_iva_bps" / 10000.0),
    "total_centavos" = oc."cantidad_pedida" * oc."precio_unitario_centavos"
      + ROUND(oc."cantidad_pedida" * oc."precio_unitario_centavos" * p."tarifa_iva_bps" / 10000.0)
FROM "proveedores" p
WHERE p."id" = oc."proveedor_id";--> statement-breakpoint
-- Cuentas por pagar pendientes: se alinean al total con IVA de su orden.
UPDATE "cuentas_por_pagar" cpp
SET "monto_centavos" = oc."total_centavos"
FROM "ordenes_compra" oc
WHERE oc."id" = cpp."orden_id" AND cpp."estado" = 'pendiente';
