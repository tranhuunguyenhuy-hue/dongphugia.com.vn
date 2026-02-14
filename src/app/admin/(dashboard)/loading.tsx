import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Loading() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-[200px]" />
                    <Skeleton className="h-4 w-[300px]" />
                </div>
                <Skeleton className="h-10 w-[120px]" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array(4).fill(null).map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                <Skeleton className="h-4 w-[100px]" />
                            </CardTitle>
                            <Skeleton className="h-4 w-4 rounded-full" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                <Skeleton className="h-8 w-[60px] mt-2" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="rounded-md border bg-white shadow-sm p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-[250px]" />
                    <Skeleton className="h-10 w-[100px]" />
                </div>
                <div className="space-y-3">
                    {Array(5).fill(null).map((_, i) => (
                        <div key={i} className="flex items-center gap-4">
                            <Skeleton className="h-12 w-full rounded-md" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
