variable "proyecto_id" {
  description = "ID del proyecto GCP"
  type        = string
}

variable "region" {
  description = "Region GCP"
  type        = string
  default     = "us-east4"
}

variable "topico_pedidos" {
  description = "Nombre del topico de pedidos"
  type        = string
  default     = "pedidos"
}

variable "topico_general" {
  description = "Nombre del topico general"
  type        = string
  default     = "general"
}

variable "url_api_buzon" {
  description = "URL publica del endpoint de procesamiento del buzon (Cloud Run + API Gateway)"
  type        = string
}

variable "cuenta_servicio_email" {
  description = "Cuenta de servicio con permiso para invocar el endpoint (OIDC)"
  type        = string
}
