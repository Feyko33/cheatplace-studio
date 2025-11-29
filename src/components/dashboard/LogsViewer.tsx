import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const LogsViewer = () => {
  const { data: logs } = useQuery({
    queryKey: ["logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("logs").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card className="card-glow">
      <CardContent className="pt-6">
        <div className="space-y-2">
          {logs?.map((log) => (
            <div key={log.id} className="flex justify-between items-center p-2 border rounded text-sm">
              <span>{log.message}</span>
              <Badge variant="outline">{log.action_type}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
