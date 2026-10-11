import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("skeleton-shimmer rounded-md", className)}
      {...props}
    />
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            borderRadius: "16px",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            overflow: "hidden",
            padding: "0",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {/* Banner */}
          <Skeleton style={{ height: "140px", width: "100%", borderRadius: "0" }} />
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <Skeleton style={{ height: "20px", width: "70%" }} />
            <Skeleton style={{ height: "14px", width: "90%" }} />
            <Skeleton style={{ height: "14px", width: "40%" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
              <Skeleton style={{ height: "16px", width: "30%" }} />
              <Skeleton style={{ height: "24px", width: "25%", borderRadius: "12px" }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
            <Skeleton style={{ width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
              <Skeleton style={{ height: "16px", width: "50%" }} />
              <Skeleton style={{ height: "12px", width: "30%" }} />
            </div>
          </div>
          {Array.from({ length: cols - 1 }).map((_, c) => (
            <Skeleton key={c} style={{ height: "16px", width: "15%", borderRadius: "6px" }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function MetricsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: "16px 20px",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <Skeleton style={{ height: "14px", width: "60%" }} />
          <Skeleton style={{ height: "28px", width: "40%", borderRadius: "8px" }} />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 4, rows }: { count?: number; rows?: number }) {
  const total = rows ?? count;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: "14px 16px",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
            <Skeleton style={{ width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
              <Skeleton style={{ height: "16px", width: "55%" }} />
              <Skeleton style={{ height: "12px", width: "35%" }} />
            </div>
          </div>
          <Skeleton style={{ height: "26px", width: "80px", borderRadius: "8px" }} />
        </div>
      ))}
    </div>
  );
}

export { Skeleton };
