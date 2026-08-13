const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) }, ...options });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export type ReminderSettings = { enabled: number; first_day: string; second_day: string; hour: number; minute: number; template: string };

export const reminderApi = {
  registerCustomer: (customer: { id:string; name:string; phone:string; whatsappOptIn:boolean; remindersEnabled:boolean }) => request("/api/customers", { method:"POST", body:JSON.stringify(customer) }),
  registerPurchase: (purchase: { id:string; customerId:string; total:number; items: unknown[]; purchasedAt:string }) => request("/api/purchases", { method:"POST", body:JSON.stringify(purchase) }),
  getSettings: () => request<ReminderSettings>("/api/reminders/settings"),
  saveSettings: (settings: Partial<ReminderSettings>) => request<ReminderSettings>("/api/reminders/settings", { method:"PUT", body:JSON.stringify(settings) }),
  runNow: () => request<{sent:number; skipped:number; failed:number}>("/api/reminders/run-now", { method:"POST" }),
  stats: () => request<{total:number; sent:number; failed:number}>("/api/reminders/stats"),
};
