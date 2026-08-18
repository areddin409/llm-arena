import { Alert, AlertDescription } from "@/features/ui/alert";
import { InfoIcon } from "lucide-react";

/**
 * Says out loud that what follows is not real data. Every screen built ahead of
 * its feature carries one — a page that quietly shows invented numbers as if
 * they were measured is exactly the thing this app exists to argue against.
 */
export function PlaceholderNotice({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <Alert>
      <InfoIcon />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
