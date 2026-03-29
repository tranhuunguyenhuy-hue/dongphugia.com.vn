'use client'

import { useEffect, useState } from 'react'
import { fetchAndExtractLinks, fetchAndExtractProduct, type CrawledProduct } from '@/lib/ai-crawler'
import { getTbvsBrands, importSingleTbvsProduct } from '@/lib/tbvs-crawler-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import {
  DownloadCloud, Play, Link as LinkIcon, AlertCircle, CheckCircle2,
  RotateCcw, Sparkles, PackageSearch, Import, Trash2, Eye
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ExtractedItem {
  url: string
  data: CrawledProduct | null
  status: 'pending' | 'extracting' | 'done' | 'error'
  selected: boolean
  message?: string
}

export function TbvsCrawlerClient() {
  const [url, setUrl] = useState('')
  const [brandId, setBrandId] = useState<number | null>(null)
  const [brands, setBrands] = useState<{ id: number; name: string }[]>([])
  const [uploadImages, setUploadImages] = useState(true)

  // Scanning state
  const [isScanning, setIsScanning] = useState(false)
  const [links, setLinks] = useState<string[]>([])

  // Extraction state
  const [isExtracting, setIsExtracting] = useState(false)
  const [items, setItems] = useState<ExtractedItem[]>([])
  const [extractProgress, setExtractProgress] = useState(0)

  // Import state
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)

  // Logs
  const [logs, setLogs] = useState<{ msg: string; success: boolean }[]>([])

  const addLog = (msg: string, success: boolean = true) => {
    setLogs(prev => [...prev, { msg, success }])
  }

  // Preview state
  const [previewItem, setPreviewItem] = useState<CrawledProduct | null>(null)

  useEffect(() => {
    getTbvsBrands().then(res => {
      if (res.success && res.data) {
        setBrands(res.data)
        if (res.data.length > 0) setBrandId(res.data[0].id)
      }
    })
  }, [])

  // Step 1: Scan product links from URL
  const handleScanLinks = async () => {
    if (!url) return toast.error('Nhập URL trang danh sách sản phẩm!')
    if (!brandId) return toast.error('Chọn thương hiệu!')

    setIsScanning(true)
    setLinks([])
    setItems([])
    addLog(`Quét links từ: ${url}...`)

    const res = await fetchAndExtractLinks(url)
    if (res.success && res.links) {
      setLinks(res.links)
      setItems(res.links.map(l => ({ url: l, data: null, status: 'pending', selected: true })))
      addLog(`Tìm thấy ${res.links.length} sản phẩm`)
      toast.success(`${res.links.length} link sản phẩm`)
    } else {
      addLog(`Lỗi: ${res.message}`, false)
      toast.error(res.message || 'Lỗi quét link')
    }
    setIsScanning(false)
  }

  // Step 2: Extract product data using AI
  const handleExtractAll = async () => {
    if (items.length === 0) return
    setIsExtracting(true)
    setExtractProgress(0)

    for (let i = 0; i < items.length; i++) {
      setItems(prev => prev.map((item, idx) =>
        idx === i ? { ...item, status: 'extracting' } : item
      ))

      addLog(`[${i + 1}/${items.length}] Trích xuất: ${items[i].url}`)
      const res = await fetchAndExtractProduct(items[i].url)

      if (res.success && res.data) {
        setItems(prev => prev.map((item, idx) =>
          idx === i ? { ...item, data: res.data!, status: 'done' } : item
        ))
        addLog(`[${i + 1}/${items.length}] OK: ${res.data.name} (${res.data.sku})`)
      } else {
        setItems(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'error', message: res.message, selected: false } : item
        ))
        addLog(`[${i + 1}/${items.length}] Lỗi: ${res.message}`, false)
      }

      setExtractProgress(Math.round(((i + 1) / items.length) * 100))
    }

    setIsExtracting(false)
    toast.success('Trích xuất hoàn tất!')
    addLog('Trích xuất hoàn tất! Kiểm tra và chọn sản phẩm muốn import.')
  }

  // Step 3: Import selected products to DB
  const handleImport = async () => {
    if (!brandId) return toast.error('Chọn thương hiệu!')
    const selected = items.filter(i => i.selected && i.data)
    if (selected.length === 0) return toast.error('Chọn ít nhất 1 sản phẩm!')

    setIsImporting(true)
    setImportProgress(0)
    addLog(`Bắt đầu import ${selected.length} sản phẩm vào DB...`)

    let successCount = 0
    for (let i = 0; i < selected.length; i++) {
      const item = selected[i]
      addLog(`[${i + 1}/${selected.length}] Import: ${item.data!.name}...`)

      const res = await importSingleTbvsProduct(item.data!, brandId, uploadImages)
      if (res.success) {
        successCount++
        addLog(`[${i + 1}/${selected.length}] ${res.message}`)
      } else {
        addLog(`[${i + 1}/${selected.length}] ${res.message}`, false)
      }

      setImportProgress(Math.round(((i + 1) / selected.length) * 100))
    }

    setIsImporting(false)
    toast.success(`Import xong: ${successCount}/${selected.length} sản phẩm`)
    addLog(`Import hoàn tất: ${successCount}/${selected.length} thành công`)
  }

  const toggleSelect = (idx: number) => {
    setItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, selected: !item.selected } : item
    ))
  }

  const toggleSelectAll = () => {
    const allSelected = items.filter(i => i.data).every(i => i.selected)
    setItems(prev => prev.map(item =>
      item.data ? { ...item, selected: !allSelected } : item
    ))
  }

  const selectedCount = items.filter(i => i.selected && i.data).length
  const isBusy = isScanning || isExtracting || isImporting

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Config */}
      <div className="bg-white border rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          AI Crawler — Thiết Bị Vệ Sinh
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">URL trang danh sách sản phẩm</label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <Input
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="pl-10 h-10"
                placeholder="https://www.toto.com.vn/bon-cau"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Thương hiệu</label>
            <Select value={brandId?.toString() || ''} onValueChange={val => setBrandId(parseInt(val))}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Chọn thương hiệu" />
              </SelectTrigger>
              <SelectContent>
                {brands.map(b => (
                  <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 flex-wrap">
          <Button onClick={handleScanLinks} disabled={isBusy} className="gap-2 bg-slate-800 hover:bg-slate-700">
            {isScanning ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Quét Links
          </Button>

          {items.length > 0 && items.some(i => i.status === 'pending') && (
            <Button onClick={handleExtractAll} disabled={isBusy} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              {isExtracting ? <RotateCcw className="w-4 h-4 animate-spin" /> : <PackageSearch className="w-4 h-4" />}
              Trích Xuất Data ({items.length})
            </Button>
          )}

          {selectedCount > 0 && (
            <Button onClick={handleImport} disabled={isBusy} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
              {isImporting ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Import className="w-4 h-4" />}
              Import ({selectedCount})
            </Button>
          )}

          <label className="flex items-center gap-2 ml-auto text-sm text-gray-600">
            <input
              type="checkbox"
              checked={uploadImages}
              onChange={e => setUploadImages(e.target.checked)}
              className="rounded border-gray-300"
            />
            Upload ảnh lên Supabase
          </label>
        </div>
      </div>

      {/* Progress */}
      {(isExtracting || isImporting) && (
        <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center text-sm font-medium">
            <span>{isExtracting ? 'Trích xuất' : 'Import'} {isExtracting ? extractProgress : importProgress}%</span>
          </div>
          <Progress value={isExtracting ? extractProgress : importProgress} className="h-2" />
        </div>
      )}

      {/* Preview table */}
      {items.some(i => i.data) && (
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <DownloadCloud className="w-5 h-5 text-green-600" />
              Kết quả trích xuất ({items.filter(i => i.data).length} sản phẩm)
            </h3>
            <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
              {items.filter(i => i.data).every(i => i.selected) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </Button>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="p-3 text-left w-10"></th>
                  <th className="p-3 text-left w-16">Ảnh</th>
                  <th className="p-3 text-left">Tên SP</th>
                  <th className="p-3 text-left">SKU</th>
                  <th className="p-3 text-left">Loại</th>
                  <th className="p-3 text-left">Chất liệu</th>
                  <th className="p-3 text-left">Xuất xứ</th>
                  <th className="p-3 text-left w-20">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  if (!item.data && item.status !== 'extracting') return null
                  const d = item.data
                  return (
                    <tr key={idx} className={`border-t hover:bg-gray-50 ${!item.selected ? 'opacity-50' : ''}`}>
                      <td className="p-3">
                        {d && (
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => toggleSelect(idx)}
                            className="rounded border-gray-300"
                          />
                        )}
                      </td>
                      <td className="p-3">
                        {d?.images[0] ? (
                          <img src={d.images[0]} alt="" className="w-12 h-12 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">N/A</div>
                        )}
                      </td>
                      <td className="p-3 font-medium max-w-[200px] truncate">{d?.name || '...'}</td>
                      <td className="p-3 text-gray-500 font-mono text-xs">{d?.sku || '...'}</td>
                      <td className="p-3 text-gray-600">{d?.productType || '—'}</td>
                      <td className="p-3 text-gray-600">{d?.material || '—'}</td>
                      <td className="p-3 text-gray-600">{d?.origin || '—'}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {d && (
                            <button
                              onClick={() => setPreviewItem(d)}
                              className="p-1.5 hover:bg-blue-50 rounded text-blue-600"
                              title="Xem chi tiết"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1.5 hover:bg-red-50 rounded text-red-500"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail preview modal */}
      {previewItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewItem(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold">{previewItem.name}</h3>
              <button onClick={() => setPreviewItem(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="font-medium text-gray-500">SKU:</span> {previewItem.sku}</div>
              <div><span className="font-medium text-gray-500">Loại:</span> {previewItem.productType || '—'}</div>
              <div><span className="font-medium text-gray-500">Chất liệu:</span> {previewItem.material || '—'}</div>
              <div><span className="font-medium text-gray-500">Màu:</span> {previewItem.color || '—'}</div>
              <div><span className="font-medium text-gray-500">Xuất xứ:</span> {previewItem.origin || '—'}</div>
              <div><span className="font-medium text-gray-500">Bảo hành:</span> {previewItem.warranty || '—'}</div>
              <div><span className="font-medium text-gray-500">Giá:</span> {previewItem.price || 'Liên hệ'}</div>
            </div>
            {previewItem.description && (
              <div className="mt-4">
                <span className="font-medium text-gray-500 text-sm">Mô tả:</span>
                <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{previewItem.description}</p>
              </div>
            )}
            {previewItem.features && (
              <div className="mt-4">
                <span className="font-medium text-gray-500 text-sm">Tính năng:</span>
                <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{previewItem.features}</p>
              </div>
            )}
            {previewItem.specifications && Object.keys(previewItem.specifications).length > 0 && (
              <div className="mt-4">
                <span className="font-medium text-gray-500 text-sm">Thông số kỹ thuật:</span>
                <div className="mt-1 grid grid-cols-2 gap-1 text-sm">
                  {Object.entries(previewItem.specifications).map(([key, val]) => (
                    <div key={key} className="flex gap-2">
                      <span className="text-gray-500">{key}:</span>
                      <span>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {previewItem.images.length > 0 && (
              <div className="mt-4">
                <span className="font-medium text-gray-500 text-sm">Hình ảnh ({previewItem.images.length}):</span>
                <div className="mt-2 flex gap-2 flex-wrap">
                  {previewItem.images.slice(0, 6).map((img, i) => (
                    <img key={i} src={img} alt="" className="w-20 h-20 object-cover rounded border" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Terminal logs */}
      <div className="bg-slate-900 border-gray-800 rounded-2xl p-4 shadow-sm h-[350px] flex flex-col">
        <h3 className="text-sm font-mono text-gray-400 border-b border-gray-800 pb-2 mb-2 flex justify-between">
          <span>Admin@AI-Crawler:~$ tail -f tbvs-crawler.log</span>
          <button onClick={() => setLogs([])} className="hover:text-white transition-colors">Clear</button>
        </h3>
        <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[13px]">
          {logs.map((log, i) => (
            <div key={i} className={`flex items-start gap-2 ${log.success ? 'text-green-400' : 'text-red-400'}`}>
              <span className="mt-0.5">{log.success ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}</span>
              <span className="leading-relaxed whitespace-pre-wrap break-words">{log.msg}</span>
            </div>
          ))}
          {logs.length === 0 && <span className="text-gray-600 italic">Waiting for command...</span>}
        </div>
      </div>
    </div>
  )
}
