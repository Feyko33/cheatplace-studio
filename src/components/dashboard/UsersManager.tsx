import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

export const UsersManager = () => {
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card className="card-glow">
      <CardContent className="pt-6">
        <div className="space-y-2">
          {users?.map((u) => (
            <div key={u.id} className="flex justify-between items-center p-2 border rounded">
              <span>{u.username}</span>
              <span className="text-sm text-muted-foreground">{u.role}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
