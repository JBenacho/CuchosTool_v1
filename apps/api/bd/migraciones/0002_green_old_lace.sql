CREATE TABLE "caso_mensajes" (
	"id" serial PRIMARY KEY NOT NULL,
	"caso_id" integer NOT NULL,
	"autor_tipo" text NOT NULL,
	"autor_id" text,
	"contenido" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "casos" (
	"id" serial PRIMARY KEY NOT NULL,
	"referencia_caso" text NOT NULL,
	"tipo" text NOT NULL,
	"estado" text DEFAULT 'abierto' NOT NULL,
	"prioridad" text DEFAULT 'media' NOT NULL,
	"cliente_id" text,
	"emprendedor_id" integer,
	"pedido_id" integer,
	"asunto" text NOT NULL,
	"descripcion" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "casos_referencia_caso_unique" UNIQUE("referencia_caso")
);
--> statement-breakpoint
CREATE TABLE "emprendedores" (
	"id" serial PRIMARY KEY NOT NULL,
	"documento_identidad" text NOT NULL,
	"nombre" text NOT NULL,
	"correo" text NOT NULL,
	"telefono" text,
	"zona_id" text,
	"estado" text DEFAULT 'enrolado' NOT NULL,
	"creado_por" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "emprendedores_documento_identidad_unique" UNIQUE("documento_identidad"),
	CONSTRAINT "emprendedores_correo_unique" UNIQUE("correo")
);
--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "emprendedor_id" integer;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "emprendedor_id" integer;--> statement-breakpoint
ALTER TABLE "caso_mensajes" ADD CONSTRAINT "caso_mensajes_caso_id_casos_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."casos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_emprendedor_id_emprendedores_id_fk" FOREIGN KEY ("emprendedor_id") REFERENCES "public"."emprendedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "casos" ADD CONSTRAINT "casos_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_emprendedor_id_emprendedores_id_fk" FOREIGN KEY ("emprendedor_id") REFERENCES "public"."emprendedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_emprendedor_id_emprendedores_id_fk" FOREIGN KEY ("emprendedor_id") REFERENCES "public"."emprendedores"("id") ON DELETE no action ON UPDATE no action;