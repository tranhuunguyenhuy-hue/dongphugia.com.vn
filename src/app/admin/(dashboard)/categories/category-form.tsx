'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Save, LayoutGrid, Image as ImageIcon, SearchIcon, Layers, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { ImageUploader } from '@/components/ui/image-uploader'

// Slug generation utility
function generateSlug(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'd')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
}

// Validation Schema
const formSchema = z.object({
    name: z.string().min(1, 'Tên danh mục là bắt buộc'),
    slug: z.string().min(1, 'Slug là bắt buộc'),
    description: z.string().optional(),
    icon_name: z.string().optional(),
    thumbnail_url: z.string().optional(),
    seo_title: z.string().optional(),
    seo_description: z.string().optional(),
    sort_order: z.string().optional(),
    is_active: z.boolean().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface CategoryFormProps {
    pageTitle: string
    pageSubtitle?: string
    category?: any
    activeBanners?: any[]
}

export function CategoryForm({ pageTitle, pageSubtitle, category, activeBanners = [] }: CategoryFormProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const isEdit = !!category

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: category?.name || '',
            slug: category?.slug || '',
            description: category?.description || '',
            icon_name: category?.icon_name || '',
            thumbnail_url: category?.thumbnail_url || '',
            seo_title: category?.seo_title || '',
            seo_description: category?.seo_description || '',
            sort_order: category?.sort_order?.toString() || '0',
            is_active: category ? category.is_active : true,
        }
    })

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value
        form.setValue('name', name)
        if (!isEdit && !form.formState.dirtyFields.slug) {
            form.setValue('slug', generateSlug(name), { shouldValidate: true })
        }
    }

    const onSubmit = async (values: FormValues) => {
        startTransition(async () => {
            // Note: Replace with actual category-actions in the future
            toast.success('Tính năng lưu danh mục đang được phát triển')
        })
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-0 z-20 bg-neutral-100/80 backdrop-blur-md pb-4 pt-2 -mt-2">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" asChild className="h-9 w-9 bg-white">
                            <Link href="/admin/categories">
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold text-[#192125] flex items-center gap-2">
                                {pageTitle}
                            </h1>
                            {pageSubtitle && (
                                <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                    <Badge variant={form.watch('is_active') ? 'default' : 'secondary'} className="h-5 px-1.5 text-[10px]">
                                        {form.watch('is_active') ? 'Hiển thị' : 'Đang ẩn'}
                                    </Badge>
                                    <span>{pageSubtitle}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button
                            type="button"
                            variant="outline"
                            className="bg-white flex-1 sm:flex-none"
                            onClick={() => router.back()}
                            disabled={isPending}
                        >
                            Hủy bỏ
                        </Button>
                        <Button
                            type="submit"
                            className="bg-[#192125] hover:bg-[#192125]/90 flex-1 sm:flex-none"
                            disabled={isPending}
                        >
                            <Save className="mr-2 h-4 w-4" />
                            {isEdit ? 'Lưu thay đổi' : 'Tạo mới'}
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Main Content - 3 columns */}
                    <div className="lg:col-span-3">
                        <Tabs defaultValue="basic" className="w-full">
                            <TabsList className="w-full justify-start h-auto p-1 bg-white border border-border/40 rounded-xl mb-6">
                                <TabsTrigger value="basic" className="data-[state=active]:bg-neutral-100 py-2.5 px-4 rounded-lg">
                                    <LayoutGrid className="h-4 w-4 mr-2" />
                                    Thông tin cơ bản
                                </TabsTrigger>
                                <TabsTrigger value="seo" className="data-[state=active]:bg-neutral-100 py-2.5 px-4 rounded-lg">
                                    <SearchIcon className="h-4 w-4 mr-2" />
                                    SEO & Meta
                                </TabsTrigger>
                                <TabsTrigger value="filters" className="data-[state=active]:bg-neutral-100 py-2.5 px-4 rounded-lg">
                                    <Layers className="h-4 w-4 mr-2" />
                                    Bộ lọc (Filters)
                                </TabsTrigger>
                                <TabsTrigger value="content" className="data-[state=active]:bg-neutral-100 py-2.5 px-4 rounded-lg">
                                    <ImageIcon className="h-4 w-4 mr-2" />
                                    Banners / Nội dung
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="basic" className="space-y-6 m-0">
                                <Card className="border-border/60 shadow-sm overflow-hidden">
                                    <CardHeader className="bg-neutral-50/50 border-b border-border/40 pb-4">
                                        <CardTitle className="text-lg">Thông tin định danh</CardTitle>
                                        <CardDescription>Tên, đường dẫn và hình ảnh đại diện</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <FormField
                                                control={form.control}
                                                name="name"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="font-semibold text-neutral-700">Tên danh mục <span className="text-red-500">*</span></FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="VD: Bồn cầu" {...field} onChange={(e) => {
                                                                field.onChange(e)
                                                                handleNameChange(e)
                                                            }} className="bg-neutral-50/50" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="slug"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="font-semibold text-neutral-700">Đường dẫn (Slug) <span className="text-red-500">*</span></FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="vd: bon-cau" {...field} className="font-mono text-sm bg-neutral-50/50" />
                                                        </FormControl>
                                                        <FormDescription className="text-xs">
                                                            URL thân thiện. Mặc định tạo từ tên danh mục.
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name="description"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold text-neutral-700">Mô tả ngắn</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            placeholder="Mô tả về danh mục này..."
                                                            className="min-h-[100px] resize-y bg-neutral-50/50"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <FormField
                                                control={form.control}
                                                name="thumbnail_url"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="font-semibold text-neutral-700">Ảnh Thumbnail (Vuông)</FormLabel>
                                                        <FormDescription className="text-xs mb-2">Dùng để hiển thị ở các lưới danh mục nổi bật ngoài trang chủ.</FormDescription>
                                                        <FormControl>
                                                            <ImageUploader
                                                                value={field.value}
                                                                onChange={field.onChange}
                                                                folder="categories"
                                                                className="h-40 w-40 aspect-square"
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="icon_name"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="font-semibold text-neutral-700">Tên Icon (Lucide)</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="VD: Box, Bath, Droplets..." {...field} className="font-mono text-sm bg-neutral-50/50 w-full md:w-2/3" />
                                                        </FormControl>
                                                        <FormDescription className="text-xs">
                                                            Tên icon để hiển thị trên thanh Menu.
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="seo" className="space-y-6 m-0">
                                <Card className="border-border/60 shadow-sm overflow-hidden">
                                    <CardHeader className="bg-neutral-50/50 border-b border-border/40 pb-4">
                                        <CardTitle className="text-lg">Tối ưu hóa Tìm kiếm (SEO)</CardTitle>
                                        <CardDescription>Cấu hình thẻ Meta cho danh mục này</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-6">
                                        <FormField
                                            control={form.control}
                                            name="seo_title"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <div className="flex justify-between items-end">
                                                        <FormLabel className="font-semibold text-neutral-700">SEO Title</FormLabel>
                                                        <span className={`text-xs ${(field.value?.length || 0) > 60 ? 'text-amber-500' : 'text-neutral-400'}`}>
                                                            {field.value?.length || 0}/60
                                                        </span>
                                                    </div>
                                                    <FormControl>
                                                        <Input placeholder="Tiêu đề hiển thị trên Google" {...field} className="bg-neutral-50/50" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="seo_description"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <div className="flex justify-between items-end">
                                                        <FormLabel className="font-semibold text-neutral-700">SEO Description</FormLabel>
                                                        <span className={`text-xs ${(field.value?.length || 0) > 160 ? 'text-amber-500' : 'text-neutral-400'}`}>
                                                            {field.value?.length || 0}/160
                                                        </span>
                                                    </div>
                                                    <FormControl>
                                                        <Textarea
                                                            placeholder="Mô tả tóm tắt hiển thị trên Google..."
                                                            className="min-h-[100px] resize-y bg-neutral-50/50"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="filters" className="space-y-6 m-0">
                                <Card className="border-border/60 shadow-sm overflow-hidden">
                                    <CardHeader className="bg-neutral-50/50 border-b border-border/40 pb-4">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            Bộ lọc (Filters)
                                        </CardTitle>
                                        <CardDescription>
                                            Định nghĩa các tiêu chí lọc cho danh mục này. Tính năng quản lý bộ lọc chuyên sâu sẽ được tích hợp tại đây.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-16 flex flex-col items-center justify-center text-center">
                                        <Layers className="h-12 w-12 text-neutral-300 mb-4" />
                                        <h3 className="text-lg font-medium text-neutral-700 mb-2">Trình quản lý bộ lọc đang được xây dựng</h3>
                                        <p className="text-sm text-neutral-500 max-w-md">
                                            Tại đây, bạn sẽ có thể tự do kéo thả, thêm bớt và định nghĩa các thuộc tính như "Kiểu dáng", "Tính năng" cho danh mục này một cách trực quan.
                                        </p>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="content" className="space-y-6 m-0">
                                <Card className="border-border/60 shadow-sm overflow-hidden border-indigo-100">
                                    <CardHeader className="bg-indigo-50/50 border-b border-indigo-100 pb-4">
                                        <CardTitle className="text-lg flex items-center gap-2 text-indigo-900">
                                            <ImageIcon className="h-5 w-5 text-indigo-500" />
                                            Banners Chiến Dịch
                                        </CardTitle>
                                        <CardDescription className="text-indigo-700/70">
                                            Quản lý Banner đã được tách thành module độc lập để dễ dàng tạo slider và hẹn giờ.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-6">
                                        <div className="bg-white border border-indigo-100 rounded-lg p-6 text-center space-y-4">
                                            <div className="flex justify-center -space-x-2">
                                                <div className="w-24 h-12 bg-indigo-100 rounded-md border-2 border-white shadow-sm flex items-center justify-center">
                                                    <ImageIcon className="h-4 w-4 text-indigo-300" />
                                                </div>
                                                <div className="w-24 h-12 bg-purple-100 rounded-md border-2 border-white shadow-sm flex items-center justify-center">
                                                    <ImageIcon className="h-4 w-4 text-purple-300" />
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-neutral-900">Tính năng quản lý Banner đã được di chuyển</h4>
                                                <p className="text-sm text-neutral-500 mt-1">
                                                    Để thay đổi banner của danh mục này, vui lòng truy cập phần Quản lý Nội dung.
                                                </p>
                                            </div>
                                            <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white mt-2">
                                                <Link href="/admin/content/banners">
                                                    Đi tới Quản lý Banners
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Sidebar - 1 column */}
                    <div className="space-y-6">
                        <Card className="border-border/60 shadow-sm">
                            <CardHeader className="pb-3 border-b border-border/40">
                                <CardTitle className="text-base">Trạng thái</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-4">
                                <FormField
                                    control={form.control}
                                    name="is_active"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-neutral-50/30">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-sm font-semibold">Hiển thị</FormLabel>
                                                <FormDescription className="text-xs">
                                                    Hiển thị trên website
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="sort_order"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-medium">Thứ tự hiển thị</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} className="bg-white" />
                                            </FormControl>
                                            <FormDescription className="text-xs">
                                                Số càng nhỏ hiển thị càng ưu tiên.
                                            </FormDescription>
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </form>
        </Form>
    )
}
