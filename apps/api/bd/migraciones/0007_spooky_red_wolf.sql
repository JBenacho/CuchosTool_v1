CREATE TABLE "proveedores" (
	"id" serial PRIMARY KEY NOT NULL,
	"nit" text NOT NULL,
	"nombre" text NOT NULL,
	"contacto" text,
	"telefono" text,
	"estado" text DEFAULT 'ACTIVO' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proveedores_nit_unique" UNIQUE("nit")
);
