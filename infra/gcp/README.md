# Infraestructura GCP (F3-GCP)

Automatiza: topicos Pub/Sub (pedidos, general, eventos-muertos) y el Cloud Scheduler
que invoca cada minuto el endpoint /buzon/procesar de la API (patron Outbox).

## Requisitos

1. Cuenta GCP con facturacion y servicios habilitados:
   gcloud services enable pubsub.googleapis.com cloudscheduler.googleapis.com --project=PROYECTO
2. CLI autenticado: gcloud auth login y gcloud auth application-default login.
3. La API desplegada en Cloud Run (con la misma cuenta de servicio configurada).

## Aplicar

terraform init
terraform plan -var "proyecto_id=PROYECTO" -var "url_api_buzon=https://API-ejecucion/buzon/procesar" -var "cuenta_servicio_email=sa@PROYECTO.iam.gserviceaccount.com"
terraform apply ...

## IAM necesaria (API en Cloud Run)

- roles/pubsub.publisher sobre los topicos (publicar eventos).
- La cuenta de servicio del Scheduler necesita roles/cloudscheduler.serviceAgent.
- La API valida el OIDC del Scheduler (mismo patron del decorador autenticar).

## Activacion en la API

En el entorno de la API configurar:

- GCP_PROYECTO_ID=PROYECTO
- PUBSUB_TOPICO_PEDIDOS=pedidos | PUBSUB_TOPICO_GENERAL=general
- GOOGLE_APPLICATION_CREDENTIALS (ADC) o cuenta de servicio del runtime.
- PROVEEDOR_PAGOS_ACTIVO=wompi + WOMPI_CLAVE_PUBLICA/PRIVADA/INTEGRIDAD/EVENTOS y WOMPI_URL_BASE.
