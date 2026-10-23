import { template as checkinLink } from './checkin-link'
import { template as checkinSelfie } from './checkin-selfie'
import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'checkin-selfie': checkinSelfie,
  'checkin-link': checkinLink,
  // Add templates here as they are created, e.g.:
  // 'welcome': welcomeTemplate,
}
