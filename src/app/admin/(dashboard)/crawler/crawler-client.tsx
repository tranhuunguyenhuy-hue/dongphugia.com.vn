'use client'

import { useEffect, useState } from 'react'
import { fetchCategoryLinks, crawlProduct, scanDeadImages, getPatternTypes } from './crawler-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { DownloadCloud, Play, Link as LinkIcon, AlertCircle, CheckCircle2, RotateCcw, ScanSearch } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function CrawlerClient() {
    const [url, setUrl] = useState('https://vietceramics.com/san-pham/gach-op-lat/gach-van-da-marble/')
    const [patternTypeId, setPatternTypeId] = useState<number | null>(null)
    const [patternTypes, setPatternTypes] = useState<{ id: number, name: string }[]>([])
    const [isScanning, setIsScanning] = useState(false)
    const [isCrawling, setIsCrawling] = useState(false)
    const [links, setLinks] = useState<string[]>([])
    const [progress, setProgress] = useState(0)
    const [logs, setLogs] = useState<{ msg: string, success: boolean }[]>([])

    useEffect(() => {
        getPatternTypes().then(res => {
            if (res.success && res.data) {
                setPatternTypes(res.data)
                if (res.data.length > 0) setPatternTypeId(res.data[0].id)
            }
        })
    }, [])

    // Cào danh sách Link
    const handleScanLinks = async () => {
        if (!url) return toast.error('Vui lòng nhập URL Danh mục!')
        setIsScanning(true)
        setLogs(prev => [...prev, { msg: `Đang quét Link từ: ${url}...`, success: true }])
        try {
            const res = await fetchCategoryLinks(url)
            if (res.success && res.links) {
                setLinks(res.links)
                setLogs(prev => [...prev, { msg: `Tìm thấy ${res.links.length} sản phẩm hợp lệ!`, success: true }])
                toast.success(`Tìm thấy ${res.links.length} Link sản phẩm`)
            } else {
                setLogs(prev => [...prev, { msg: `Lỗi Quét Link: ${res.message}`, success: false }])
                toast.error('Có lỗi quét link: ' + res.message)
            }
        } catch (error: any) {
            setLogs(prev => [...prev, { msg: `Lỗi: ${error.message}`, success: false }])
        } finally {
            setIsScanning(false)
        }
    }

    // Cào từng Sản Phẩm
    const handleStartCrawl = async () => {
        if (links.length === 0) return toast.error('Chưa có Link nào để Crawl!')
        if (!patternTypeId) return toast.error('Vui lòng chọn Kiểu Vân Gạch!')
        setIsCrawling(true)
        setProgress(0)

        for (let i = 0; i < links.length; i++) {
            const pUrl = links[i]
            try {
                const res = await crawlProduct(pUrl, patternTypeId)
                if (res.success) {
                    setLogs(prev => [...prev, { msg: `[${i + 1}/${links.length}] Thành công: ${res.message}`, success: true }])
                } else {
                    setLogs(prev => [...prev, { msg: `[${i + 1}/${links.length}] Lỗi: ${pUrl} - ${res.message}`, success: false }])
                }
            } catch (error: any) {
                setLogs(prev => [...prev, { msg: `[${i + 1}/${links.length}] Lỗi nặng: ${error.message}`, success: false }])
            }
            // Update Progress Bar
            setProgress(Math.round(((i + 1) / links.length) * 100))
        }

        setIsCrawling(false)
        toast.success(`Hoàn tất Crawl ${links.length} sản phẩm!`)
        setLogs(prev => [...prev, { msg: `🚀 CHIẾN DỊCH HOÀN TẤT: Cào xong ${links.length} sản phẩm!`, success: true }])
    }

    // Bot quét rác hình ảnh (Hotlink Checker)
    const handleScanDeadImages = async () => {
        setIsScanning(true)
        setLogs(prev => [...prev, { msg: `Đang khởi động Bot quét link ảnh...`, success: true }])
        try {
            const res = await scanDeadImages()
            if (res.success) {
                setLogs(prev => [...prev, { msg: res.message, success: true }])
                toast.success('Kiểm tra ảnh hoàn tất')
            } else {
                setLogs(prev => [...prev, { msg: res.message, success: false }])
                toast.error('Có lỗi quét ảnh')
            }
        } catch (error: any) {
            setLogs(prev => [...prev, { msg: `Lỗi: ${error.message}`, success: false }])
        } finally {
            setIsScanning(false)
        }
    }

    return (
        <div className="space-y-6 max-w-5xl">
            <div className="bg-white border rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <DownloadCloud className="w-5 h-5 text-green-600" />
                    Cấu Hình Nguồn Dữ Liệu
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Đường dẫn Danh mục (URL)</label>
                        <div className="relative">
                            <LinkIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            <Input
                                value={url}
                                onChange={e => setUrl(e.target.value)}
                                className="pl-10 h-10"
                                placeholder="https://vietceramics.com/san-pham/..."
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Chọn Kiểu Vân Gạch (Đã có trong DB)</label>
                        <Select value={patternTypeId?.toString() || ""} onValueChange={(val) => setPatternTypeId(parseInt(val))}>
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="Chọn Kiểu Vân" />
                            </SelectTrigger>
                            <SelectContent>
                                {patternTypes.map(type => (
                                    <SelectItem key={type.id} value={type.id.toString()}>
                                        {type.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                    <Button onClick={handleScanLinks} disabled={isScanning || isCrawling} className="gap-2 bg-slate-800 hover:bg-slate-700">
                        {isScanning ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Quét Tìm Link Sản Phẩm
                    </Button>
                    {links.length > 0 && (
                        <Button onClick={handleStartCrawl} disabled={isCrawling} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                            {isCrawling ? <RotateCcw className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
                            Bắt đầu Bào Data ({links.length})
                        </Button>
                    )}
                    <Button onClick={handleScanDeadImages} disabled={isScanning || isCrawling} variant="outline" className="gap-2 ml-auto text-orange-600 border-orange-200 hover:bg-orange-50">
                        <ScanSearch className="w-4 h-4" />
                        Quét Rác Hình Ảnh (Hotlinks)
                    </Button>
                </div>
            </div>

            {/* Tiến Trình */}
            {links.length > 0 && (
                <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex justify-between items-center text-sm font-medium">
                        <span>Tiến trình đồng bộ {progress}%</span>
                        <span className="text-gray-500">{Math.round((progress / 100) * links.length)} / {links.length} Hoàn tất</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                </div>
            )}

            {/* Logs Hiển Thị Terminal (Dark mode) */}
            <div className="bg-slate-900 border-gray-800 rounded-2xl p-4 shadow-sm h-[400px] flex flex-col">
                <h3 className="text-sm font-mono text-gray-400 border-b border-gray-800 pb-2 mb-2 flex justify-between">
                    <span>Admin@Terminal:~$ tail -f crawler.log</span>
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
