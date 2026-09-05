# Infraestructura GCP de CuchosTool (F3-GCP): Pub/Sub + Cloud Scheduler.
# Aplicar: terraform init && terraform apply (ver README.md de esta carpeta).
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.proyecto_id
  region  = var.region
}

# Topicos de eventos (BL-101/102): pedidos y general.
resource "google_pubsub_topic" "pedidos" {
  name = var.topico_pedidos
}

resource "google_pubsub_topic" "general" {
  name = var.topico_general
}

# Topico de mensajes muertos (DLQ operable, BL-091).
resource "google_pubsub_topic" "eventos_muertos" {
  name = "eventos-muertos"
}

# Cloud Scheduler: dispara cada minuto el procesador del buzon de la API.
# El endpoint /buzon/procesar debe estar protegido (OIDC con la cuenta de servicio).
resource "google_cloud_scheduler_job" "publicador_buzon" {
  name        = "publicador-buzon"
  description = "Procesa el buzon transaccional de CuchosTool (patron Outbox)"
  schedule    = "* * * * *"
  time_zone   = "America/Bogota"

  http_target {
    http_method = "POST"
    uri         = var.url_api_buzon
    body        = base64encode("{}")
    headers = {
      "Content-Type" = "application/json"
    }
    oidc_token {
      service_account_email = var.cuenta_servicio_email
    }
  }
}
