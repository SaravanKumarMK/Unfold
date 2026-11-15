variable "name" {
  description = "Repository name prefix, e.g. unfold-dev."
  type        = string
}

variable "repositories" {
  description = "Image targets of backend/Dockerfile (docker/backend.Dockerfile)."
  type        = list(string)
  default     = ["api", "worker", "exporter", "web"]
}

variable "keep_tagged_images" {
  description = "Tagged images kept per repository: the live one and the one to roll back to. Stored images are the only recurring cost of an idle stack."
  type        = number
  default     = 2
}

variable "force_delete" {
  description = "Delete repositories that still hold images (dev only)."
  type        = bool
  default     = false
}
