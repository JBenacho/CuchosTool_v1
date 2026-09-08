CREATE TABLE "bodegas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"ubicacion" text,
	"estado" text DEFAULT 'ACTIVO' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bodegas_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "inventario_stock" (
	"id" serial PRIMARY KEY NOT NULL,
	"bodega_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"cantidad" integer DEFAULT 0 NOT NULL,
	"stock_minimo" integer DEFAULT 0 NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movimientos_inventario" (
	"id" serial PRIMARY KEY NOT NULL,
	"consecutivo" text NOT NULL,
	"bodega_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"cantidad" integer NOT NULL,
	"stock_resultante" integer NOT NULL,
	"motivo" text NOT NULL,
	"referencia" text,
	"actor_id" text,
	"actor_rol" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movimientos_inventario_consecutivo_unique" UNIQUE("consecutivo")
);
--> statement-breakpoint
ALTER TABLE "inventario_stock" ADD CONSTRAINT "inventario_stock_bodega_id_bodegas_id_fk" FOREIGN KEY ("bodega_id") REFERENCES "public"."bodegas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventario_stock" ADD CONSTRAINT "inventario_stock_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_bodega_id_bodegas_id_fk" FOREIGN KEY ("bodega_id") REFERENCES "public"."bodegas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventario_stock_bodega_producto_idx" ON "inventario_stock" USING btree ("bodega_id","producto_id");--> statement-breakpoint
CREATE INDEX "movimientos_inventario_producto_idx" ON "movimientos_inventario" USING btree ("producto_id");--> statement-breakpoint
CREATE INDEX "movimientos_inventario_bodega_idx" ON "movimientos_inventario" USING btree ("bodega_id");