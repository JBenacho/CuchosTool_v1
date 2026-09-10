CREATE TABLE "asiento_lineas" (
	"id" serial PRIMARY KEY NOT NULL,
	"asiento_id" integer NOT NULL,
	"cuenta_id" integer NOT NULL,
	"debito_centavos" bigint DEFAULT 0 NOT NULL,
	"credito_centavos" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asientos_contables" (
	"id" serial PRIMARY KEY NOT NULL,
	"referencia" text NOT NULL,
	"descripcion" text NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asientos_contables_referencia_unique" UNIQUE("referencia")
);
--> statement-breakpoint
CREATE TABLE "cuentas_contables" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"naturaleza" text DEFAULT 'debito' NOT NULL,
	"estado" text DEFAULT 'ACTIVO' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cuentas_contables_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "facturas" (
	"id" serial PRIMARY KEY NOT NULL,
	"numero" text NOT NULL,
	"cliente_empresa_id" integer NOT NULL,
	"orden_b2b_id" integer,
	"impuesto_id" integer,
	"base_centavos" bigint NOT NULL,
	"impuesto_centavos" bigint DEFAULT 0 NOT NULL,
	"total_centavos" bigint NOT NULL,
	"moneda" text DEFAULT 'COP' NOT NULL,
	"estado" text DEFAULT 'emitida' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"anulado_en" timestamp with time zone,
	CONSTRAINT "facturas_numero_unique" UNIQUE("numero"),
	CONSTRAINT "facturas_orden_b2b_id_unique" UNIQUE("orden_b2b_id")
);
--> statement-breakpoint
CREATE TABLE "impuestos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"tipo" text DEFAULT 'iva' NOT NULL,
	"tarifa_bps" integer DEFAULT 0 NOT NULL,
	"estado" text DEFAULT 'ACTIVO' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "impuestos_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "notas_factura" (
	"id" serial PRIMARY KEY NOT NULL,
	"factura_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"monto_centavos" bigint NOT NULL,
	"motivo" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asiento_lineas" ADD CONSTRAINT "asiento_lineas_asiento_id_asientos_contables_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos_contables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asiento_lineas" ADD CONSTRAINT "asiento_lineas_cuenta_id_cuentas_contables_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."cuentas_contables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_cliente_empresa_id_clientes_empresa_id_fk" FOREIGN KEY ("cliente_empresa_id") REFERENCES "public"."clientes_empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_orden_b2b_id_ordenes_venta_b2b_id_fk" FOREIGN KEY ("orden_b2b_id") REFERENCES "public"."ordenes_venta_b2b"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_impuesto_id_impuestos_id_fk" FOREIGN KEY ("impuesto_id") REFERENCES "public"."impuestos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_factura" ADD CONSTRAINT "notas_factura_factura_id_facturas_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."facturas"("id") ON DELETE no action ON UPDATE no action;