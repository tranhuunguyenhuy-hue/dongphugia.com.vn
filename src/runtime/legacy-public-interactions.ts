'use server'

import type { PublicContactPayload } from '@dpg/app-contracts'

import { getMegaMenuData as getLegacyMegaMenuData } from '@/app/actions/mega-menu-actions'
import { submitContactForm as submitLegacyContactForm } from '@/lib/actions'

export async function getMegaMenuData() {
  return getLegacyMegaMenuData()
}

export async function submitContactForm(payload: PublicContactPayload) {
  return submitLegacyContactForm(payload)
}
