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
                <Button variant="ghost" size="sm">
                  Edit
                </Button>
                <Button variant="ghost" size="sm">
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
