import { Skeleton } from "@/components/ui/skeleton";

export default function TemplateDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <Skeleton className="h-24 rounded-[20px]" />
      <Skeleton className="mt-8 h-64 rounded-[20px]" />
    </div>
  );
}
