CREATE TABLE "clientes_empresa" (
	"id" serial PRIMARY KEY NOT NULL,
	"nit" text NOT NULL,
	"razon_social" text NOT NULL,
	"contacto" text,
	"telefono" text,
	"correo" text,
	"cupo_credito_centavos" bigint DEFAULT 0 NOT NULL,
	"estado" text DEFAULT 'ACTIVO' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clientes_empresa_nit_unique" UNIQUE("nit")
);
--> statement-breakpoint
CREATE TABLE "orden_venta_b2b_articulos" (
	"id" serial PRIMARY KEY NOT NULL,
	"orden_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"precio_unitario_centavos" bigint NOT NULL,
	"subtotal_centavos" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ordenes_venta_b2b" (
	"id" serial PRIMARY KEY NOT NULL,
	"folio" text NOT NULL,
	"cliente_empresa_id" integer NOT NULL,
	"vendedor_id" text NOT NULL,
	"bodega_id" integer NOT NULL,
	"forma_pago" text DEFAULT 'credito' NOT NULL,
	"subtotal_centavos" bigint NOT NULL,
	"total_centavos" bigint NOT NULL,
	"moneda" text DEFAULT 'COP' NOT NULL,
	"estado" text DEFAULT 'confirmada' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ordenes_venta_b2b_folio_unique" UNIQUE("folio")
);
--> statement-breakpoint
ALTER TABLE "orden_venta_b2b_articulos" ADD CONSTRAINT "orden_venta_b2b_articulos_orden_id_ordenes_venta_b2b_id_fk" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_venta_b2b"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_venta_b2b_articulos" ADD CONSTRAINT "orden_venta_b2b_articulos_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_venta_b2b" ADD CONSTRAINT "ordenes_venta_b2b_cliente_empresa_id_clientes_empresa_id_fk" FOREIGN KEY ("cliente_empresa_id") REFERENCES "public"."clientes_empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_venta_b2b" ADD CONSTRAINT "ordenes_venta_b2b_bodega_id_bodegas_id_fk" FOREIGN KEY ("bodega_id") REFERENCES "public"."bodegas"("id") ON DELETE no action ON UPDATE no action;