"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Heart,
  ShoppingCart,
  Search,
  ChevronRight,
  Star,
  Eye,
  Trash2,
  Plus,
  Edit,
  Download,
  Mail,
  Phone,
  MapPin,
  Check,
  X,
  AlertTriangle,
  Info,
} from "lucide-react";
import React from "react";

// ============================================
// Design System Showcase Page
// Displays all UI components, colors, typography
// for evaluation and testing before redesign.
// ============================================

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              🎨 Design System — Đông Phú Gia
            </h1>
            <p className="text-xs text-muted-foreground">
              Component Inventory & Visual Showcase
            </p>
          </div>
          <nav className="flex gap-2">
            <a href="#colors" className="text-sm text-muted-foreground hover:text-primary transition-colors px-2 py-1">Colors</a>
            <a href="#typography" className="text-sm text-muted-foreground hover:text-primary transition-colors px-2 py-1">Typography</a>
            <a href="#buttons" className="text-sm text-muted-foreground hover:text-primary transition-colors px-2 py-1">Buttons</a>
            <a href="#badges" className="text-sm text-muted-foreground hover:text-primary transition-colors px-2 py-1">Badges</a>
            <a href="#cards" className="text-sm text-muted-foreground hover:text-primary transition-colors px-2 py-1">Cards</a>
            <a href="#forms" className="text-sm text-muted-foreground hover:text-primary transition-colors px-2 py-1">Forms</a>
            <a href="#animations" className="text-sm text-muted-foreground hover:text-primary transition-colors px-2 py-1">Animations</a>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-16">

        {/* ============================================
         * SECTION 1: COLOR PALETTE
         * ============================================ */}
        <section id="colors">
          <SectionHeader
            title="🎨 Color Palette"
            description="CSS Variables defined in globals.css — Design Tokens hiện tại"
          />

          {/* Primary & Brand Colors */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Primary & Brand
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <ColorSwatch name="Primary" value="#2E7A96" cssVar="--color-primary" />
              <ColorSwatch name="Primary FG" value="#ffffff" cssVar="--color-primary-foreground" dark />
              <ColorSwatch name="Secondary" value="#EAF6FB" cssVar="--color-secondary" />
              <ColorSwatch name="Secondary FG" value="#0F2E3A" cssVar="--color-secondary-foreground" />
              <ColorSwatch name="Accent" value="#EAF6FB" cssVar="--color-accent" />
              <ColorSwatch name="Accent FG" value="#2E7A96" cssVar="--color-accent-foreground" />
            </div>
          </div>

          {/* Background & Foreground */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Background & Foreground
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <ColorSwatch name="Background" value="#ffffff" cssVar="--color-background" />
              <ColorSwatch name="Foreground" value="#192125" cssVar="--color-foreground" />
              <ColorSwatch name="Card" value="#ffffff" cssVar="--color-card" />
              <ColorSwatch name="Card FG" value="#192125" cssVar="--color-card-foreground" />
              <ColorSwatch name="Popover" value="#ffffff" cssVar="--color-popover" />
              <ColorSwatch name="Popover FG" value="#192125" cssVar="--color-popover-foreground" />
            </div>
          </div>

          {/* Neutral & Muted */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Neutral & Muted
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <ColorSwatch name="Muted" value="#F5F9FB" cssVar="--color-muted" />
              <ColorSwatch name="Muted FG" value="#6A8A97" cssVar="--color-muted-foreground" />
              <ColorSwatch name="Border" value="#E4EEF2" cssVar="--color-border" />
              <ColorSwatch name="Input" value="#E4EEF2" cssVar="--color-input" />
              <ColorSwatch name="Ring" value="#2E7A96" cssVar="--color-ring" />
              <ColorSwatch name="Destructive" value="#ef4444" cssVar="--color-destructive" />
            </div>
          </div>

          {/* Sidebar Tokens */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Sidebar
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <ColorSwatch name="Sidebar" value="#ffffff" cssVar="--color-sidebar" />
              <ColorSwatch name="Sidebar FG" value="#3C4E56" cssVar="--color-sidebar-foreground" />
              <ColorSwatch name="Sidebar Border" value="#F5F9FB" cssVar="--color-sidebar-border" />
              <ColorSwatch name="Sidebar Hover" value="#EAF6FB" cssVar="--color-sidebar-hover" />
              <ColorSwatch name="Sidebar Active" value="#C5E8F5" cssVar="--color-sidebar-active" />
              <ColorSwatch name="Sidebar Act FG" value="#2E7A96" cssVar="--color-sidebar-active-foreground" />
            </div>
          </div>

          {/* Stat Colors */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Stat Card Colors
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <ColorSwatch name="Blue" value="#3b82f6" cssVar="--color-stat-blue" />
              <ColorSwatch name="Orange" value="#f97316" cssVar="--color-stat-orange" />
              <ColorSwatch name="Emerald" value="#10b981" cssVar="--color-stat-emerald" />
              <ColorSwatch name="Purple" value="#8b5cf6" cssVar="--color-stat-purple" />
              <ColorSwatch name="Rose" value="#f43f5e" cssVar="--color-stat-rose" />
              <ColorSwatch name="Cyan" value="#06b6d4" cssVar="--color-stat-cyan" />
              <ColorSwatch name="Amber" value="#EBBE74" cssVar="--color-stat-amber" />
            </div>
          </div>

          {/* Hardcoded Colors Warning */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-amber-800 font-semibold mb-2">
              <AlertTriangle className="size-4" />
              Hardcoded Colors Found (cần refactor)
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-3">
              <ColorSwatch name=".prose h2" value="#192125" cssVar="hardcoded" />
              <ColorSwatch name=".prose h3" value="#263238" cssVar="hardcoded" />
              <ColorSwatch name=".prose bq" value="#516A74" cssVar="hardcoded" />
              <ColorSwatch name=".prose bq-border" value="#C8D9E0" cssVar="hardcoded" />
              <ColorSwatch name=".prose strong" value="#192125" cssVar="hardcoded" />
              <ColorSwatch name="Skeleton" value="#F5F9FB → #E4EEF2" cssVar="hardcoded" />
            </div>
          </div>
        </section>

        <Separator />

        {/* ============================================
         * SECTION 2: TYPOGRAPHY
         * ============================================ */}
        <section id="typography">
          <SectionHeader
            title="✍️ Typography"
            description="Font: Inter (--font-sans) — Scale hiện tại"
          />

          <div className="space-y-6">
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4">
              <span className="text-xs text-muted-foreground font-mono">text-4xl (36px)</span>
              <p className="text-4xl font-bold text-foreground">Đông Phú Gia — Thiết Bị Vệ Sinh</p>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4">
              <span className="text-xs text-muted-foreground font-mono">text-3xl (30px)</span>
              <p className="text-3xl font-bold text-foreground">Thương hiệu hàng đầu cho ngôi nhà Việt</p>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4">
              <span className="text-xs text-muted-foreground font-mono">text-2xl (24px)</span>
              <p className="text-2xl font-semibold text-foreground">Danh mục sản phẩm thiết bị vệ sinh</p>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4">
              <span className="text-xs text-muted-foreground font-mono">text-xl (20px)</span>
              <p className="text-xl font-semibold text-foreground">Bồn cầu Caesar — Nhập khẩu chính hãng</p>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4">
              <span className="text-xs text-muted-foreground font-mono">text-lg (18px)</span>
              <p className="text-lg font-medium text-foreground">Sản phẩm được ưa chuộng nhất tháng 3/2026</p>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4">
              <span className="text-xs text-muted-foreground font-mono">text-base (16px)</span>
              <p className="text-base text-foreground">Chất liệu sứ cao cấp, phủ men nano chống bám bẩn, tiết kiệm nước với hệ thống xả 2 chế độ.</p>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4">
              <span className="text-xs text-muted-foreground font-mono">text-sm (14px)</span>
              <p className="text-sm text-muted-foreground">Liên hệ: 0909 123 456 — Showroom: 123 Nguyễn Văn Linh, Q.7, HCM</p>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-baseline gap-4">
              <span className="text-xs text-muted-foreground font-mono">text-xs (12px)</span>
              <p className="text-xs text-muted-foreground">SKU: DPG-CS-2026-001 • Bảo hành 36 tháng • Miễn phí vận chuyển nội thành</p>
            </div>
          </div>

          {/* Font weights */}
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Font Weights</h3>
            <div className="space-y-3">
              <p className="text-lg font-light text-foreground">Light (300) — Thiết bị vệ sinh cao cấp</p>
              <p className="text-lg font-normal text-foreground">Normal (400) — Thiết bị vệ sinh cao cấp</p>
              <p className="text-lg font-medium text-foreground">Medium (500) — Thiết bị vệ sinh cao cấp</p>
              <p className="text-lg font-semibold text-foreground">Semibold (600) — Thiết bị vệ sinh cao cấp</p>
              <p className="text-lg font-bold text-foreground">Bold (700) — Thiết bị vệ sinh cao cấp</p>
              <p className="text-lg font-extrabold text-foreground">Extrabold (800) — Thiết bị vệ sinh cao cấp</p>
            </div>
          </div>
        </section>

        <Separator />

        {/* ============================================
         * SECTION 3: BUTTONS
         * ============================================ */}
        <section id="buttons">
          <SectionHeader
            title="🔘 Buttons"
            description="6 variants × 8 sizes — CVA (class-variance-authority)"
          />

          {/* Variants */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Variants</h3>
            <div className="flex flex-wrap gap-3 items-center">
              <Button variant="default">Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
            </div>
          </div>

          {/* Sizes */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Sizes</h3>
            <div className="flex flex-wrap gap-3 items-center">
              <Button size="xs">Extra Small</Button>
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
            </div>
          </div>

          {/* Icon Buttons */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Icon Buttons</h3>
            <div className="flex flex-wrap gap-3 items-center">
              <Button size="icon-xs" variant="ghost"><Heart /></Button>
              <Button size="icon-sm" variant="outline"><ShoppingCart /></Button>
              <Button size="icon" variant="default"><Search /></Button>
              <Button size="icon-lg" variant="secondary"><Eye /></Button>
            </div>
          </div>

          {/* With Icons */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">With Icons</h3>
            <div className="flex flex-wrap gap-3 items-center">
              <Button><Plus className="size-4" /> Thêm sản phẩm</Button>
              <Button variant="destructive"><Trash2 className="size-4" /> Xóa</Button>
              <Button variant="outline"><Download className="size-4" /> Xuất báo cáo</Button>
              <Button variant="secondary"><Edit className="size-4" /> Chỉnh sửa</Button>
            </div>
          </div>

          {/* States */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">States</h3>
            <div className="flex flex-wrap gap-3 items-center">
              <Button>Normal</Button>
              <Button disabled>Disabled</Button>
              <Button className="press-effect">Press Effect (click me)</Button>
            </div>
          </div>
        </section>

        <Separator />

        {/* ============================================
         * SECTION 4: BADGES
         * ============================================ */}
        <section id="badges">
          <SectionHeader
            title="🏷️ Badges"
            description="6 variants — CVA (class-variance-authority)"
          />
          <div className="flex flex-wrap gap-3 items-center">
            <Badge variant="default">Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="ghost">Ghost</Badge>
            <Badge variant="link">Link</Badge>
          </div>

          {/* Use Cases */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Use Cases</h3>
            <div className="flex flex-wrap gap-3 items-center">
              <Badge variant="default">Mới</Badge>
              <Badge variant="destructive">Hết hàng</Badge>
              <Badge variant="secondary">Giảm 30%</Badge>
              <Badge variant="outline">Còn 5 sản phẩm</Badge>
              <Badge className="bg-amber-500 text-white">Best Seller</Badge>
              <Badge className="bg-blue-500 text-white">Caesar</Badge>
              <Badge className="badge-pulse bg-orange-500 text-white">Flash Sale</Badge>
            </div>
          </div>
        </section>

        <Separator />

        {/* ============================================
         * SECTION 5: CARDS
         * ============================================ */}
        <section id="cards">
          <SectionHeader
            title="🃏 Cards"
            description="Card component + card-hover utility class"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Basic Card */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Card</CardTitle>
                <CardDescription>Mô tả ngắn về card cơ bản</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Card mặc định với header, content, và footer. Dùng cho thông tin tổng quan.
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm">Xem thêm</Button>
              </CardFooter>
            </Card>

            {/* Card with Hover */}
            <Card className="card-hover cursor-pointer">
              <CardHeader>
                <CardTitle>Card with Hover</CardTitle>
                <CardDescription>Hover để thấy hiệu ứng nâng</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Sử dụng class <code className="text-xs bg-muted px-1 py-0.5 rounded">.card-hover</code> để tạo hiệu ứng translateY(-2px) khi hover.
                </p>
              </CardContent>
              <CardFooter className="justify-between">
                <span className="text-sm font-semibold text-primary">2,450,000₫</span>
                <Button size="sm"><ShoppingCart className="size-3" /> Mua ngay</Button>
              </CardFooter>
            </Card>

            {/* Product Card Preview */}
            <Card className="card-hover overflow-hidden">
              <div className="aspect-square bg-muted flex items-center justify-center">
                <span className="text-4xl">🚿</span>
              </div>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">Bồn cầu Caesar CD1320</CardTitle>
                  <Badge variant="secondary">Mới</Badge>
                </div>
                <CardDescription>Caesar — Nhập khẩu chính hãng</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-primary">5,890,000₫</span>
                  <span className="text-sm text-muted-foreground line-through">6,500,000₫</span>
                </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button className="flex-1" size="sm">
                  <ShoppingCart className="size-3" /> Thêm giỏ hàng
                </Button>
                <Button variant="outline" size="icon-sm">
                  <Heart className="size-4" />
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Stat Cards */}
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Stat Gradient Cards</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { name: "Blue", cls: "stat-gradient-blue", color: "text-blue-700" },
                { name: "Orange", cls: "stat-gradient-orange", color: "text-orange-700" },
                { name: "Emerald", cls: "stat-gradient-emerald", color: "text-emerald-700" },
                { name: "Purple", cls: "stat-gradient-purple", color: "text-purple-700" },
                { name: "Rose", cls: "stat-gradient-rose", color: "text-rose-700" },
                { name: "Cyan", cls: "stat-gradient-cyan", color: "text-cyan-700" },
                { name: "Amber", cls: "stat-gradient-amber", color: "text-amber-700" },
              ].map((s) => (
                <div key={s.name} className={`${s.cls} rounded-lg p-4`}>
                  <p className={`text-xs font-medium ${s.color}`}>{s.name}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>1,234</p>
                  <p className="text-xs text-muted-foreground mt-1">+12.5%</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Separator />

        {/* ============================================
         * SECTION 6: FORM CONTROLS
         * ============================================ */}
        <section id="forms">
          <SectionHeader
            title="📝 Form Controls"
            description="Input, Textarea, Checkbox, Select, Label"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Inputs */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Input</h3>
              <div className="space-y-2">
                <Label htmlFor="input-default">Tên sản phẩm</Label>
                <Input id="input-default" placeholder="Nhập tên sản phẩm..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="input-search">Tìm kiếm</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input id="input-search" className="pl-9" placeholder="Tìm thiết bị vệ sinh..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="input-disabled">Disabled</Label>
                <Input id="input-disabled" disabled placeholder="Không thể chỉnh sửa" />
              </div>
            </div>

            {/* Textarea & Checkbox */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Textarea & Checkbox</h3>
              <div className="space-y-2">
                <Label htmlFor="textarea">Mô tả sản phẩm</Label>
                <Textarea id="textarea" placeholder="Nhập mô tả chi tiết..." rows={3} />
              </div>
              <div className="space-y-3 mt-4">
                <div className="flex items-center gap-2">
                  <Checkbox id="check1" defaultChecked />
                  <Label htmlFor="check1" className="text-sm">Hiển thị trên trang chủ</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="check2" />
                  <Label htmlFor="check2" className="text-sm">Sản phẩm nổi bật</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="check3" disabled />
                  <Label htmlFor="check3" className="text-sm text-muted-foreground">Đã ngừng kinh doanh</Label>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* ============================================
         * SECTION 7: TABS
         * ============================================ */}
        <section id="tabs">
          <SectionHeader
            title="📑 Tabs"
            description="Tabs component — Radix UI"
          />
          <Tabs defaultValue="overview" className="max-w-2xl">
            <TabsList>
              <TabsTrigger value="overview">Tổng quan</TabsTrigger>
              <TabsTrigger value="specs">Thông số kỹ thuật</TabsTrigger>
              <TabsTrigger value="reviews">Đánh giá</TabsTrigger>
              <TabsTrigger value="support">Hỗ trợ</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4">
              <p className="text-sm text-muted-foreground">
                Bồn cầu Caesar CD1320 được thiết kế với phong cách hiện đại, phù hợp với mọi không gian phòng tắm.
                Sản phẩm sử dụng công nghệ xả xoáy mạnh mẽ, tiết kiệm nước.
              </p>
            </TabsContent>
            <TabsContent value="specs" className="mt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">Kích thước</span>
                  <span className="font-medium">700 × 370 × 760mm</span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">Chất liệu</span>
                  <span className="font-medium">Sứ Vitreous China</span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">Lượng nước xả</span>
                  <span className="font-medium">3/6 lít</span>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="reviews" className="mt-4">
              <div className="flex items-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className={`size-4 ${i <= 4 ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
                ))}
                <span className="text-sm text-muted-foreground ml-2">4.0/5 (128 đánh giá)</span>
              </div>
            </TabsContent>
            <TabsContent value="support" className="mt-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><Phone className="size-4 text-primary" /> 0909 123 456</div>
                <div className="flex items-center gap-2"><Mail className="size-4 text-primary" /> support@dongphugia.com.vn</div>
                <div className="flex items-center gap-2"><MapPin className="size-4 text-primary" /> 123 Nguyễn Văn Linh, Q.7, TP.HCM</div>
              </div>
            </TabsContent>
          </Tabs>
        </section>

        <Separator />

        {/* ============================================
         * SECTION 8: LOADING STATES
         * ============================================ */}
        <section id="loading">
          <SectionHeader
            title="⏳ Loading States"
            description="Skeleton, Progress, Shimmer"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Skeleton */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Skeleton</h3>
              <div className="space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-32 w-full" />
                <div className="flex gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              </div>
            </div>

            {/* Progress & Shimmer */}
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Progress</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Tải sản phẩm...</span>
                      <span>30%</span>
                    </div>
                    <Progress value={30} />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Hoàn thành</span>
                      <span>75%</span>
                    </div>
                    <Progress value={75} />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Shimmer</h3>
                <div className="space-y-2">
                  <div className="skeleton-shimmer h-4 w-full rounded" />
                  <div className="skeleton-shimmer h-4 w-2/3 rounded" />
                  <div className="skeleton-shimmer h-20 w-full rounded" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* ============================================
         * SECTION 9: ANIMATIONS
         * ============================================ */}
        <section id="animations">
          <SectionHeader
            title="✨ Animations & Micro-interactions"
            description="Keyframes & utility classes from globals.css"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Fade In */}
            <AnimationDemo
              name="fade-in"
              description="animate-page-enter — 0.3s ease-out"
              cssClass="animate-page-enter"
            />
            {/* Card Hover */}
            <AnimationDemo
              name="card-hover"
              description="translateY(-2px) + shadow — hover"
              cssClass="card-hover"
              isHover
            />
            {/* Press Effect */}
            <AnimationDemo
              name="press-effect"
              description="scale(0.97) — active"
              cssClass="press-effect"
              isClick
            />
            {/* Badge Pulse */}
            <AnimationDemo
              name="badge-pulse"
              description="opacity 0.7↔1.0 — 2s infinite"
              cssClass="badge-pulse"
            />
            {/* Shimmer */}
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-2">skeleton-shimmer</h4>
              <p className="text-xs text-muted-foreground mb-3">background slide — 2s infinite</p>
              <div className="skeleton-shimmer h-8 w-full rounded" />
            </div>
            {/* Marquee */}
            <div className="border rounded-lg p-4 overflow-hidden">
              <h4 className="text-sm font-semibold mb-2">animate-marquee</h4>
              <p className="text-xs text-muted-foreground mb-3">translateX scroll — 25s linear infinite</p>
              <div className="flex whitespace-nowrap">
                <span className="animate-marquee text-sm text-primary font-medium">
                  🔥 Flash Sale — Giảm 30% toàn bộ thiết bị vệ sinh Caesar — Chỉ trong hôm nay!&nbsp;&nbsp;&nbsp;
                  🔥 Flash Sale — Giảm 30% toàn bộ thiết bị vệ sinh Caesar — Chỉ trong hôm nay!&nbsp;&nbsp;&nbsp;
                </span>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* ============================================
         * SECTION 10: BORDER RADIUS
         * ============================================ */}
        <section id="radius">
          <SectionHeader
            title="📐 Border Radius"
            description="Token từ globals.css"
          />
          <div className="flex flex-wrap gap-6 items-end">
            <RadiusDemo name="radius-sm" value="calc(0.75rem - 4px)" className="rounded-sm" />
            <RadiusDemo name="radius-md" value="calc(0.75rem - 2px)" className="rounded-md" />
            <RadiusDemo name="radius" value="0.5rem" className="rounded" />
            <RadiusDemo name="radius-lg" value="0.75rem" className="rounded-lg" />
            <RadiusDemo name="rounded-xl" value="1rem (tw)" className="rounded-xl" />
            <RadiusDemo name="rounded-full" value="9999px (tw)" className="rounded-full" />
          </div>
        </section>

        <Separator />

        {/* ============================================
         * SECTION 11: SEPARATORS & DIVIDERS
         * ============================================ */}
        <section id="separators">
          <SectionHeader
            title="➖ Separators"
            description="Separator component — Radix UI"
          />
          <div className="space-y-4 max-w-lg">
            <Separator />
            <p className="text-sm text-muted-foreground">Horizontal separator (mặc định)</p>
            <div className="flex items-center gap-4 h-8">
              <span className="text-sm">Item 1</span>
              <Separator orientation="vertical" />
              <span className="text-sm">Item 2</span>
              <Separator orientation="vertical" />
              <span className="text-sm">Item 3</span>
            </div>
          </div>
        </section>

        <Separator />

        {/* ============================================
         * SECTION 12: ALERT STATES
         * ============================================ */}
        <section id="alerts">
          <SectionHeader
            title="⚡ Alert States"
            description="Context-based messaging patterns"
          />
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
              <Check className="size-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">Thành công</p>
                <p className="text-xs text-green-600">Sản phẩm đã được thêm vào giỏ hàng.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <Info className="size-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800">Thông tin</p>
                <p className="text-xs text-blue-600">Đơn hàng của bạn đang được xử lý.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="size-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Cảnh báo</p>
                <p className="text-xs text-amber-600">Sản phẩm này sắp hết hàng, chỉ còn 2 sản phẩm.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <X className="size-5 text-red-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Lỗi</p>
                <p className="text-xs text-red-600">Không thể kết nối đến máy chủ. Vui lòng thử lại sau.</p>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* ============================================
         * SECTION 13: TABLE ROW HOVER
         * ============================================ */}
        <section id="table">
          <SectionHeader
            title="📊 Table"
            description="Table component + table-row-hover utility"
          />
          <div className="border rounded-lg overflow-hidden max-w-3xl">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">SKU</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Sản phẩm</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Thương hiệu</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Giá</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { sku: "CS-1320", name: "Bồn cầu CD1320", brand: "Caesar", price: "5,890,000₫", status: "Còn hàng" },
                  { sku: "IN-4150", name: "Vòi chậu IN-4150", brand: "Inax", price: "2,350,000₫", status: "Còn hàng" },
                  { sku: "TT-7020", name: "Sen tắm TT-7020", brand: "TOTO", price: "8,450,000₫", status: "Hết hàng" },
                  { sku: "KL-3001", name: "Lavabo KL-3001", brand: "Kohler", price: "4,200,000₫", status: "Sắp hết" },
                ].map((item) => (
                  <tr key={item.sku} className="table-row-hover border-t">
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{item.sku}</td>
                    <td className="py-3 px-4 font-medium">{item.name}</td>
                    <td className="py-3 px-4">{item.brand}</td>
                    <td className="py-3 px-4 text-right font-semibold text-primary">{item.price}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge
                        variant={item.status === "Còn hàng" ? "default" : item.status === "Hết hàng" ? "destructive" : "outline"}
                      >
                        {item.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-8 text-sm text-muted-foreground">
          <p>Design System — Đông Phú Gia • Generated for redesign evaluation</p>
          <p className="mt-1">27 UI components • 30+ CSS variables • 7 keyframes • 20+ utility classes</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

function ColorSwatch({
  name,
  value,
  cssVar,
  dark = false,
}: {
  name: string;
  value: string;
  cssVar: string;
  dark?: boolean;
}) {
  const isHardcoded = cssVar === "hardcoded";
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={`h-16 rounded-lg border shadow-sm flex items-end p-2 ${dark ? "border-gray-300" : ""}`}
        style={{ backgroundColor: value.split(" → ")[0] }}
      >
        <span className={`text-[10px] font-mono ${dark || value.startsWith("#0") || value.startsWith("#1") || value.startsWith("#3") || value.startsWith("#4") || value.startsWith("#6") || value.startsWith("#8") ? "text-white" : "text-gray-800"}`}>
          {value}
        </span>
      </div>
      <div>
        <p className="text-xs font-medium leading-tight">{name}</p>
        <p className={`text-[10px] font-mono ${isHardcoded ? "text-amber-600" : "text-muted-foreground"}`}>
          {cssVar}
        </p>
      </div>
    </div>
  );
}

function AnimationDemo({
  name,
  description,
  cssClass,
  isHover = false,
  isClick = false,
}: {
  name: string;
  description: string;
  cssClass: string;
  isHover?: boolean;
  isClick?: boolean;
}) {
  const [key, setKey] = React.useState(0);

  if (isHover || isClick) {
    return (
      <div className="border rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-2">{name}</h4>
        <p className="text-xs text-muted-foreground mb-3">{description}</p>
        <div className={`bg-primary/10 h-12 rounded-lg flex items-center justify-center text-sm font-medium text-primary cursor-pointer ${cssClass}`}>
          {isHover ? "Hover me" : "Click me"}
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4">
      <h4 className="text-sm font-semibold mb-2">{name}</h4>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      <div key={key} className={`bg-primary/10 h-12 rounded-lg flex items-center justify-center text-sm font-medium text-primary ${cssClass}`}>
        Animation Demo
      </div>
      <button
        onClick={() => setKey((k) => k + 1)}
        className="mt-2 text-xs text-primary hover:underline"
      >
        ↻ Replay
      </button>
    </div>
  );
}

function RadiusDemo({ name, value, className }: { name: string; value: string; className: string }) {
  return (
    <div className="text-center">
      <div className={`size-16 bg-primary/20 border-2 border-primary ${className}`} />
      <p className="text-xs font-medium mt-2">{name}</p>
      <p className="text-[10px] text-muted-foreground font-mono">{value}</p>
    </div>
  );
}
