CREATE TABLE "auditoria_registros" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_rol" text,
	"accion" text NOT NULL,
	"recurso" text NOT NULL,
	"recurso_id" text,
	"resultado" text NOT NULL,
	"metadatos" jsonb,
	"ip" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carrito_articulos" (
	"id" serial PRIMARY KEY NOT NULL,
	"carrito_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"agregado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carritos" (
	"id" serial PRIMARY KEY NOT NULL,
	"cliente_id" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "carritos_cliente_id_unique" UNIQUE("cliente_id")
);
--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"slug" text NOT NULL,
	"posicion" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categorias_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"correo" text NOT NULL,
	"hash_contrasena" text NOT NULL,
	"nombre" text NOT NULL,
	"estado" text DEFAULT 'ACTIVO' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clientes_correo_unique" UNIQUE("correo")
);
--> statement-breakpoint
CREATE TABLE "eventos_buzon" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo_agregado" text NOT NULL,
	"id_agregado" text NOT NULL,
	"tipo_evento" text NOT NULL,
	"carga" jsonb NOT NULL,
	"correlacion_id" text,
	"clave_idempotencia" text,
	"version" integer DEFAULT 1 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"publicado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pedido_articulos" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"precio_unitario_centavos" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" serial PRIMARY KEY NOT NULL,
	"referencia_pedido" text NOT NULL,
	"cliente_id" text NOT NULL,
	"estado" text DEFAULT 'pendiente_pago' NOT NULL,
	"subtotal_centavos" bigint NOT NULL,
	"envio_centavos" bigint DEFAULT 0 NOT NULL,
	"total_centavos" bigint NOT NULL,
	"moneda" text DEFAULT 'COP' NOT NULL,
	"clave_idempotencia" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pedidos_referencia_pedido_unique" UNIQUE("referencia_pedido"),
	CONSTRAINT "pedidos_clave_idempotencia_unique" UNIQUE("clave_idempotencia")
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" serial PRIMARY KEY NOT NULL,
	"categoria_id" integer,
	"nombre" text NOT NULL,
	"slug" text NOT NULL,
	"descripcion" text,
	"precio_centavos" bigint NOT NULL,
	"moneda" text DEFAULT 'COP' NOT NULL,
	"estado" text DEFAULT 'ACTIVO' NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"url_imagen" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "productos_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"correo" text NOT NULL,
	"hash_contrasena" text NOT NULL,
	"rol" text NOT NULL,
	"zona_id" text,
	"vendedor_id" text,
	"estado" text DEFAULT 'ACTIVO' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_correo_unique" UNIQUE("correo")
);
--> statement-breakpoint
ALTER TABLE "carrito_articulos" ADD CONSTRAINT "carrito_articulos_carrito_id_carritos_id_fk" FOREIGN KEY ("carrito_id") REFERENCES "public"."carritos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_articulos" ADD CONSTRAINT "pedido_articulos_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "carrito_articulos_carrito_producto_idx" ON "carrito_articulos" USING btree ("carrito_id","producto_id");--> statement-breakpoint
CREATE INDEX "productos_categoria_idx" ON "productos" USING btree ("categoria_id");--> statement-breakpoint
CREATE INDEX "productos_estado_idx" ON "productos" USING btree ("estado");