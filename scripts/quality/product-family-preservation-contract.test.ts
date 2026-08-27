import { describe, expect, it } from 'vitest'
import {
  PRODUCT_FAMILY_PRESERVATION_CONTRACT,
  evaluateProductFamilyPreservationContract,
  loadProductFamilyPreservationSources,
  validateMs885PreservationSnapshot,
  type Ms885PreservationSnapshot,
} from './product-family-preservation-contract'

const acceptedSnapshot: Ms885PreservationSnapshot = {
  familyKey: PRODUCT_FAMILY_PRESERVATION_CONTRACT.ms885.familyKey,
  canonicalMemberKeys: [
    'MS885DE2#XW', 'MS885DE4#XW', 'MS885DT2#XW', 'MS885DT3#XW', 'MS885DT8#XW',
    'MS885DW4#XW', 'MS885DW6#XW', 'MS885DW7#XW', 'MS885DW11#XW', 'MS885DW14#XW',
    'MS885DW16#XW', 'MS885DW18#XW', 'MS885CDW12#XW', 'MS885CDW15#XW', 'MS885CDW17#XW',
    'MS885CDW23#XW', 'MS885CDW24#XW', 'MS885CDW25#XW', 'MS885DW24#XW', 'MS885DW25#XW',
  ],
  memberships: [
    { memberKey: 'MS885DE2#XW', groupKey: 'ecowasher' },
    { memberKey: 'MS885DE4#XW', groupKey: 'ecowasher' },
    { memberKey: 'MS885DT2#XW', groupKey: 'soft-close' },
    { memberKey: 'MS885DT3#XW', groupKey: 'soft-close' },
    { memberKey: 'MS885DT8#XW', groupKey: 'soft-close' },
    { memberKey: 'MS885DW6#XW', groupKey: 'electronic-washlet' },
    { memberKey: 'MS885DW7#XW', groupKey: 'electronic-washlet' },
    { memberKey: 'MS885DW11#XW', groupKey: 'electronic-washlet' },
    { memberKey: 'MS885DW14#XW', groupKey: 'electronic-washlet' },
    { memberKey: 'MS885DW16#XW', groupKey: 'electronic-washlet' },
    { memberKey: 'MS885CDW12#XW', groupKey: 'electronic-washlet' },
    { memberKey: 'MS885CDW15#XW', groupKey: 'electronic-washlet' },
    { memberKey: 'MS885CDW17#XW', groupKey: 'electronic-washlet' },
    { memberKey: 'MS885CDW23#XW', groupKey: 'electronic-washlet' },
    { memberKey: 'MS885CDW24#XW', groupKey: 'electronic-washlet' },
    { memberKey: 'MS885CDW25#XW', groupKey: 'electronic-washlet' },
    { memberKey: 'MS885DW24#XW', groupKey: 'electronic-washlet' },
    { memberKey: 'MS885DW25#XW', groupKey: 'electronic-washlet' },
  ],
  catalogueGapKeys: ['MS885DW4#XW', 'MS885DW18#XW'],
  deferredOutsideFamily: ['MS885DE6#XW'],
}

describe('Product/Family preservation contract', () => {
  it('passes against the canonical migration, schema, and Product/Family models', async () => {
    const sources = await loadProductFamilyPreservationSources()
    expect(evaluateProductFamilyPreservationContract(sources)).toEqual([])
  })

  it('fails when a protected migration fixture is perturbed in memory', async () => {
    const sources = await loadProductFamilyPreservationSources()
    const perturbed = {
      ...sources,
      migrationSql: sources.migrationSql.replace("('MS885DE2#XW'", "('MS885DE9#XW'"),
    }
    expect(evaluateProductFamilyPreservationContract(perturbed)).toContain('canonical Family migration checksum changed')
    expect(evaluateProductFamilyPreservationContract(perturbed)).toContain('MS885 approved migration member contract changed')
  })

  it('fails when a protected schema identifier fixture is removed in memory', async () => {
    const sources = await loadProductFamilyPreservationSources()
    const perturbed = {
      ...sources,
      schemaManifest: {
        ...sources.schemaManifest,
        objects: sources.schemaManifest.objects.filter((object) => object.identity !== 'public.product_family_memberships'),
      },
    }
    expect(evaluateProductFamilyPreservationContract(perturbed)).toContain('protected schema table missing: public.product_family_memberships')
  })

  it('fails when a protected Family table fixture changes in memory', async () => {
    const sources = await loadProductFamilyPreservationSources()
    const perturbed = {
      ...sources,
      schemaManifest: {
        ...sources.schemaManifest,
        objects: sources.schemaManifest.objects.map((object) => object.identity === 'public.product_families'
          ? { ...object, properties: { ...object.properties, drift: true } }
          : object),
      },
    }
    expect(evaluateProductFamilyPreservationContract(perturbed)).toContain('protected schema table changed: public.product_families')
  })

  it('fails when accepted MS885 data is perturbed without writing canonical data', () => {
    expect(validateMs885PreservationSnapshot(acceptedSnapshot)).toEqual([])
    const perturbed = {
      ...acceptedSnapshot,
      memberships: acceptedSnapshot.memberships.map((membership, index) => index === 0
        ? { ...membership, groupKey: 'electronic-washlet' }
        : membership),
    }
    expect(validateMs885PreservationSnapshot(perturbed)).toContain('MS885 membership group changed for MS885DE2#XW')
  })
})
