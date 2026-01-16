import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useToast } from "../components/ui/toast";
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Briefcase, 
  Calendar, 
  XCircle, 
  Plus,
  Check,
  Building2,
  CalendarClock
} from "lucide-react";

const parseUTCDate = (dateString: string) => {
  return new Date(dateString.includes('Z') ? dateString : dateString + 'Z');
};

interface TaskWithContext {
  id: string;
  application_id: string | null;
  kind: "followup" | "prep" | "thank_you";
  due_at: string | null;
  status: "pending" | "completed" | "cancelled";
  notes: string | null;
  created_at: string;
  updated_at: string;
  role_title: string | null;
  company_name: string | null;
}

export function Tasks() {
  const { addToast } = useToast();
  const [tasks, setTasks] = useState<TaskWithContext[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    kind: "followup" as const,
    notes: "",
    due_at: "",
  });

  const fetchTasks = async () => {
    const pending = filter === "pending" ? "?pending=true" : "";
    const res = await fetch(`/api/tasks${pending}`);
    const data = await res.json();
    setTasks(data);
  };

  useEffect(() => {
    fetchTasks().finally(() => setLoading(false));
  }, [filter]);

  const handleMarkDone = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      fetchTasks();
    } catch (error) {
      console.error("Failed to mark task done:", error);
      addToast({ title: "Failed to update task", variant: "error" });
    }
  };

  const handleMarkPending = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      fetchTasks();
    } catch (error) {
      console.error("Failed to mark task pending:", error);
      addToast({ title: "Failed to update task", variant: "error" });
    }
  };

  const handleCreateTask = async () => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: newTask.kind,
          notes: newTask.notes || null,
          due_at: newTask.due_at || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create task");
      setDialogOpen(false);
      setNewTask({ kind: "followup", notes: "", due_at: "" });
      fetchTasks();
    } catch (error) {
      console.error("Failed to create task:", error);
      addToast({ title: "Failed to create task", variant: "error" });
    }
  };

  const isOverdue = (dueAt: string | null) => {
    if (!dueAt) return false;
    return parseUTCDate(dueAt) < new Date();
  };

  const getTaskIcon = (kind: string) => {
    switch (kind) {
      case "followup":
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case "prep":
        return <Briefcase className="h-4 w-4 text-blue-500" />;
      case "thank_you":
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      default:
        return <Clock className="h-4 w-4 text-slate-400" />;
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === "pending") return task.status === "pending";
    if (filter === "completed") return task.status === "completed";
    return true;
  });

  const upcomingInterviews = tasks.filter(
    (t) => t.kind === "prep" && t.status === "pending" && t.due_at
  );

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tasks</h1>
          <p className="text-muted-foreground mt-1">Stay on top of your job search to-dos.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="kind">Task Type</Label>
                <Select value={newTask.kind} onValueChange={(v: string) => setNewTask({ ...newTask, kind: v as typeof newTask.kind })}>
                  <SelectTrigger id="kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="followup">Follow-up</SelectItem>
                    <SelectItem value="prep">Interview Prep</SelectItem>
                    <SelectItem value="thank_you">Thank You</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_at">Due Date (optional)</Label>
                <Input
                  id="due_at"
                  type="datetime-local"
                  value={newTask.due_at}
                  onChange={(e) => setNewTask({ ...newTask, due_at: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={newTask.notes}
                  onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                  placeholder="Add any notes about this task..."
                  className="min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateTask}>Create Task</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={filter} onValueChange={(v: string) => setFilter(v as typeof filter)} className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
          <TabsTrigger 
            value="all" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3"
          >
            All Tasks
          </TabsTrigger>
          <TabsTrigger 
            value="pending"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3"
          >
            Pending
          </TabsTrigger>
          <TabsTrigger 
            value="completed"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3"
          >
            Completed
          </TabsTrigger>
        </TabsList>

        <div className="mt-6 space-y-6">
          {upcomingInterviews.length > 0 && filter !== "completed" && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-blue-100 bg-blue-50/80 flex items-center justify-between">
                <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" />
                  Upcoming Interviews
                </h3>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200">
                  {upcomingInterviews.length} upcoming
                </Badge>
              </div>
              <div className="divide-y divide-blue-100/50">
                {upcomingInterviews.map((task) => (
                  <div key={task.id} className="p-4 flex items-start gap-4 hover:bg-blue-50/80 transition-colors">
                    <div className="mt-1 p-2 bg-blue-100 rounded-lg text-blue-600">
                      <Briefcase className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-slate-900 truncate">
                          {task.company_name} - {task.role_title}
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                          onClick={() => handleMarkDone(task.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                      {task.due_at && (
                        <p className="text-sm text-blue-700 mt-0.5 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {parseUTCDate(task.due_at).toLocaleString(undefined, { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </p>
                      )}
                      {task.notes && (
                        <p className="text-sm text-slate-600 mt-2 bg-white/50 p-2 rounded border border-blue-100/50">
                          {task.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <TabsContent value={filter} className="m-0">
            {filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl border-slate-100 bg-slate-50/50">
                <div className="p-4 bg-white rounded-full shadow-sm mb-3">
                  <CheckCircle className="h-8 w-8 text-slate-200" />
                </div>
                <h3 className="text-lg font-medium text-slate-900">No {filter !== "all" ? filter : ""} tasks</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {filter === "pending" 
                    ? "You're all caught up! Enjoy the peace of mind." 
                    : "Tasks you complete will appear here."}
                </p>
                {filter === "pending" && (
                  <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                    Create a task
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredTasks.map((task) => {
                  const overdue = isOverdue(task.due_at);
                  const isPending = task.status === "pending";
                  
                  if (upcomingInterviews.find(t => t.id === task.id) && filter !== "completed") {
                    return null;
                  }

                  return (
                    <div
                      key={task.id}
                      className={`
                        group flex items-start gap-4 p-4 rounded-xl border bg-white transition-all duration-200
                        ${isPending ? 'shadow-sm hover:shadow-md hover:border-slate-300' : 'opacity-60 bg-slate-50 border-slate-100'}
                        ${overdue && isPending ? 'border-red-200 bg-red-50/30' : ''}
                      `}
                    >
                      <button
                        onClick={() => isPending ? handleMarkDone(task.id) : handleMarkPending(task.id)}
                        className={`
                          mt-1 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors
                          ${isPending 
                            ? 'border-slate-300 hover:border-emerald-500 text-transparent hover:text-emerald-500' 
                            : 'border-emerald-500 bg-emerald-500 text-white'}
                        `}
                      >
                        <Check className="h-3 w-3" />
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-slate-900'}`}>
                            {task.kind === 'followup' ? 'Follow up' : task.kind === 'prep' ? 'Interview Prep' : 'Thank You Note'}
                          </span>
                          {task.company_name && (
                            <Badge variant="outline" className="font-normal text-muted-foreground bg-slate-50">
                              {task.company_name}
                            </Badge>
                          )}
                          {overdue && isPending && (
                            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">Overdue</Badge>
                          )}
                        </div>
                        
                        {task.notes && (
                          <p className="text-sm text-slate-600 mb-2">{task.notes}</p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {task.due_at && (
                            <span className={`flex items-center gap-1.5 ${overdue && isPending ? 'text-red-600 font-medium' : ''}`}>
                              <Calendar className="h-3.5 w-3.5" />
                              {parseUTCDate(task.due_at).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            Created {parseUTCDate(task.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity -mr-2"
                        onClick={() => {}}
                      >
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
