import { describe, expect, it } from 'vitest'

import {
  LEO553_GITHUB_DISPATCH_URL,
  LEO553_GITHUB_EVENT_TYPE,
  parseLeo553BridgeResult,
  parseLeo553Request,
  schedulerResponse,
} from './leo553'

describe('LEO-553 scheduler bridge boundary', () => {
  it('accepts only the fixed LEO-543 request contract', () => {
    expect(parseLeo553Request({
      source: 'leo543',
      run_id: '018f0f42-b334-4cc1-9f1a-3a43c8e74f27',
      slot_at: '2026-08-29T10:00:00Z',
    })).toEqual({
      source: 'leo543',
      run_id: '018f0f42-b334-4cc1-9f1a-3a43c8e74f27',
      slot_at: '2026-08-29T10:00:00.000Z',
    })
    expect(parseLeo553Request({ source: 'candidate', run_id: 'main', slot_at: 'now' })).toBeNull()
  })

  it('rejects unbounded or inconsistent database responses', () => {
    expect(parseLeo553BridgeResult({
      result_code: 'SUCCESS', processed_count: 1, published_count: 1,
      blocked_count: 0, refresh_required: true,
    })).not.toBeNull()
    expect(parseLeo553BridgeResult({
      result_code: 'SUCCESS', processed_count: 1, published_count: 2,
      blocked_count: 0, refresh_required: true,
    })).toBeNull()
    expect(parseLeo553BridgeResult({
      result_code: 'RAW_DATABASE_ERROR', processed_count: 0, published_count: 0,
      blocked_count: 0, refresh_required: false,
    })).toBeNull()
  })

  it('returns only the LEO-543 bounded response fields', () => {
    expect(schedulerResponse({
      result_code: 'SUCCESS', processed_count: 1, published_count: 1,
      blocked_count: 0, refresh_required: true,
    })).toEqual({
      result_code: 'SUCCESS', processed_count: 1, published_count: 1,
      blocked_count: 0,
    })
  })

  it('fixes repository and event type outside caller input', () => {
    expect(LEO553_GITHUB_DISPATCH_URL).toBe(
      'https://api.github.com/repos/tranhuunguyenhuy-hue/dongphugia.com.vn/dispatches',
    )
    expect(LEO553_GITHUB_EVENT_TYPE).toBe('leo553-preview-refresh')
  })
})
