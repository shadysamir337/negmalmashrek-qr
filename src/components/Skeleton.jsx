// Tiny skeleton placeholder components to replace plain "Loading…" text.

export function SkeletonLine({ className = '' }) {
    return <div className={`skeleton h-3 ${className}`} />
}

export function SkeletonCard({ className = '' }) {
    return (
        <div className={`card p-4 space-y-3 ${className}`}>
            <SkeletonLine className="w-1/3" />
            <SkeletonLine className="w-2/3" />
            <SkeletonLine className="w-1/2" />
        </div>
    )
}

export function SkeletonGrid({ count = 8 }) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="card p-3 sm:p-4 flex flex-col items-center">
                    <div className="skeleton w-[140px] h-[140px] rounded-xl" />
                    <div className="mt-3 skeleton h-3 w-2/3" />
                    <div className="mt-2 skeleton h-3 w-1/3" />
                </div>
            ))}
        </div>
    )
}

export function SkeletonList({ count = 6 }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="card p-3 flex items-center gap-3">
                    <div className="skeleton w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <SkeletonLine className="w-1/3" />
                        <SkeletonLine className="w-1/4" />
                    </div>
                </div>
            ))}
        </div>
    )
}
