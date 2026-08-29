import { describe, expect, it } from 'vitest'

import {
  LEO553_GITHUB_WORKFLOW_DISPATCH_URL,
  LEO553_GITHUB_WORKFLOW_REF,
  LEO553_PUBLISHING_PARITY_APPROVED,
  parseLeo553BridgeResult,
  parseLeo553Request,
  parseWorkflowDispatchRunId,
  schedulerResponse,
  shouldDispatchPreviewRefresh,
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

  it('dispatches only for an accepted publication change', () => {
    expect(shouldDispatchPreviewRefresh({
      result_code: 'SUCCESS', processed_count: 0, published_count: 0,
      blocked_count: 0, refresh_required: false,
    })).toBe(false)
    expect(shouldDispatchPreviewRefresh({
      result_code: 'SUCCESS', processed_count: 1, published_count: 1,
      blocked_count: 0, refresh_required: true,
    })).toBe(true)
  })

  it('fixes repository, workflow, and ref outside caller input', () => {
    expect(LEO553_GITHUB_WORKFLOW_DISPATCH_URL).toBe(
      'https://api.github.com/repos/tranhuunguyenhuy-hue/dongphugia.com.vn/actions/workflows/preview-publishing-refresh.yml/dispatches',
    )
    expect(LEO553_GITHUB_WORKFLOW_REF).toBe('main')
  })

  it('accepts only a sanitized workflow run identity from GitHub', () => {
    expect(parseWorkflowDispatchRunId({ workflow_run_id: 33249502023 })).toBe(33249502023)
    expect(parseWorkflowDispatchRunId({ workflow_run_id: '33249502023' })).toBeNull()
    expect(parseWorkflowDispatchRunId({ workflow_run_id: -1 })).toBeNull()
    expect(parseWorkflowDispatchRunId({ html_url: 'https://example.invalid/secret' })).toBeNull()
  })

  it('keeps scheduler publication disabled until canonical parity is approved', () => {
    expect(LEO553_PUBLISHING_PARITY_APPROVED).toBe(false)
  })
})
