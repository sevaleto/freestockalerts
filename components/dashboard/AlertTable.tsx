"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPrice } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";

interface AlertRow {
  id: string;
  ticker: string;
  alertType: string;
  triggerValue: number;
  currentPrice: number | null;
  isActive: boolean;
}

interface AlertTableProps {
  alerts: AlertRow[];
}

export function AlertTable({ alerts }: AlertTableProps) {
  const router = useRouter();

  const handleDelete = async (alertId: string, ticker: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the ${ticker} alert?`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/alerts/${alertId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete alert");
      }
      router.refresh();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to delete alert"
      );
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-white shadow-soft">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ticker</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Current</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((alert) => (
            <TableRow key={alert.id}>
              <TableCell className="font-semibold text-text-primary">
                {alert.ticker}
              </TableCell>
              <TableCell className="text-text-secondary">
                {alert.alertType.replace(/_/g, " ")}
              </TableCell>
              <TableCell>{formatPrice(alert.triggerValue)}</TableCell>
              <TableCell>{formatPrice(alert.currentPrice ?? 0)}</TableCell>
              <TableCell>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    alert.isActive
                      ? "bg-success/10 text-success"
                      : "bg-text-muted/10 text-text-muted"
                  )}
                >
                  {alert.isActive ? "Active" : "Paused"}
                </span>
              </TableCell>
              <TableCell className="space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled
                  title="Coming soon"
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(alert.id, alert.ticker)}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
